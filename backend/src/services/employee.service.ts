import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query, execute, withTransaction } from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './audit.service';

export interface CreateEmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  fatherName?: string | null;
  cnic?: string | null;
  email?: string | null;
  phone?: string | null;
  designation?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  currentResortId: string;
  hireDate?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  deviceUserId?: string | null;
  shiftStart?: string | null;
  shiftEnd?: string | null;
  fingerStatus?: 'not_captured' | 'captured' | 'failed';
}

export async function listEmployees(filters: {
  resortId?: string | null;
  locationIds?: string[] | null;
  search?: string;
  status?: string;
  departmentId?: string;
  gender?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(1, filters.limit ?? 20), 10000);
  const offset = (page - 1) * limit;
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.status) {
    clauses.push('e.status = :status');
    params.status = filters.status;
  }
  if (filters.resortId) {
    clauses.push('e.current_resort_id = :resortId');
    params.resortId = filters.resortId;
  } else if (filters.locationIds) {
    if (filters.locationIds.length === 0) return { rows: [], total: 0, page, limit };
    clauses.push(`e.current_resort_id IN (${filters.locationIds.map((_, i) => `:loc${i}`).join(',')})`);
    filters.locationIds.forEach((id, i) => {
      params[`loc${i}`] = id;
    });
  }
  if (filters.departmentId) {
    clauses.push('e.department_id = :departmentId');
    params.departmentId = filters.departmentId;
  }
  if (filters.gender) {
    clauses.push('e.gender = :gender');
    params.gender = filters.gender;
  }
  if (filters.search) {
    clauses.push(
      `(e.employee_code LIKE :search OR e.device_user_id LIKE :search OR e.first_name LIKE :search OR e.last_name LIKE :search OR e.email LIKE :search)`
    );
    params.search = `%${filters.search}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const countRows = await query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM employees e ${where}`,
    params
  );
  const rows = await query<RowDataPacket[]>(
    `SELECT e.id, e.employee_code AS employeeCode, e.first_name AS firstName, e.last_name AS lastName,
            e.designation, e.email, e.phone, e.gender, e.status, e.current_resort_id AS currentResortId,
            e.department_id AS departmentId,
            e.device_user_id AS deviceUserId, e.shift_start AS shiftStart, e.shift_end AS shiftEnd,
            e.finger_status AS fingerStatus,
            r.name AS resortName, d.name AS departmentName, e.hire_date AS hireDate
     FROM employees e
     LEFT JOIN resorts r ON r.id = e.current_resort_id
     LEFT JOIN departments d ON d.id = e.department_id
     ${where}
     ORDER BY e.last_name, e.first_name
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return { rows, total: Number(countRows[0].total), page, limit };
}

export interface EmployeeRecord extends RowDataPacket {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  department_id: string | null;
  current_resort_id: string | null;
  gender?: string | null;
  status?: string;
  resortName?: string;
  departmentName?: string;
  postings?: RowDataPacket[];
}

export async function getEmployeeById(id: string): Promise<EmployeeRecord> {
  const rows = await query<EmployeeRecord[]>(
    `SELECT e.*, r.name AS resortName, d.name AS departmentName
     FROM employees e
     LEFT JOIN resorts r ON r.id = e.current_resort_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE e.id = :id LIMIT 1`,
    { id }
  );
  if (!rows.length) throw new NotFoundError('Employee not found');

  const postings = await query<RowDataPacket[]>(
    `SELECT ep.*, rs.name AS resortName
     FROM employee_postings ep
     INNER JOIN resorts rs ON rs.id = ep.resort_id
     WHERE ep.employee_id = :id
     ORDER BY ep.effective_from DESC`,
    { id }
  );

  return { ...rows[0], postings };
}

export async function createEmployee(input: CreateEmployeeInput, actorUserId: string) {
  const dup = await query<RowDataPacket[]>(
    `SELECT id FROM employees WHERE employee_code = :code LIMIT 1`,
    { code: input.employeeCode.trim().toUpperCase() }
  );
  if (dup.length) throw new ConflictError('Employee code already exists');

  const resort = await query<RowDataPacket[]>(
    `SELECT id FROM resorts WHERE id = :id AND status = 'active' LIMIT 1`,
    { id: input.currentResortId }
  );
  if (!resort.length) throw new ValidationError('Invalid or inactive resort');

  const id = randomUUID();
  const postingId = randomUUID();
  const code = input.employeeCode.trim().toUpperCase();
  const departmentId = await resolveDepartment(input.departmentId, input.departmentName);
  const shiftStart = normalizeTime(input.shiftStart);
  const shiftEnd = normalizeTime(input.shiftEnd);

  await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO employees (
        id, employee_code, first_name, last_name, father_name, cnic, email, phone, gender,
        device_user_id, shift_start, shift_end, finger_status,
        designation, department_id, current_resort_id, hire_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        id,
        code,
        input.firstName.trim(),
        input.lastName.trim(),
        input.fatherName ?? null,
        input.cnic ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.gender ?? null,
        input.deviceUserId ?? null,
        shiftStart,
        shiftEnd,
        input.fingerStatus ?? 'not_captured',
        input.designation ?? null,
        departmentId,
        input.currentResortId,
        input.hireDate ?? null,
      ]
    );
    await conn.execute(
      `INSERT INTO employee_postings (
        id, employee_id, resort_id, department_id, designation, effective_from, is_current
      ) VALUES (?, ?, ?, ?, ?, COALESCE(?, CURDATE()), 1)`,
      [
        postingId,
        id,
        input.currentResortId,
        departmentId,
        input.designation ?? null,
        input.hireDate ?? null,
      ]
    );

    if (input.deviceUserId) {
      await conn.execute(
        `INSERT INTO device_employee_mappings (id, device_id, device_user_id, employee_id, is_active)
         SELECT ?, d.id, ?, ?, 1
         FROM attendance_devices d
         WHERE d.resort_id = ? AND NOT EXISTS (
           SELECT 1 FROM device_employee_mappings m
           WHERE m.device_id = d.id AND m.device_user_id = ?
         )
         LIMIT 1`,
        [randomUUID(), input.deviceUserId, id, input.currentResortId, input.deviceUserId]
      );
    }
  });

  await writeAuditLog({
    actorUserId,
    action: 'employee.create',
    entityType: 'employee',
    entityId: id,
    resortId: input.currentResortId,
    afterData: { id, employeeCode: code },
  });

  return getEmployeeById(id);
}

export async function transferEmployee(
  employeeId: string,
  input: {
    toResortId: string;
    toDepartmentId?: string | null;
    transferDate: string;
    designation?: string | null;
    reason?: string | null;
  },
  actorUserId: string
) {
  const employee = await getEmployeeById(employeeId);
  if (employee.current_resort_id === input.toResortId) {
    throw new ValidationError('Employee is already posted at the target resort');
  }

  const transferId = randomUUID();
  const newPostingId = randomUUID();

  await withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE employee_postings
       SET is_current = 0, effective_to = DATE_SUB(?, INTERVAL 1 DAY)
       WHERE employee_id = ? AND is_current = 1`,
      [input.transferDate, employeeId]
    );

    await conn.execute(
      `INSERT INTO employee_postings (
        id, employee_id, resort_id, department_id, designation, effective_from, is_current, notes
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        newPostingId,
        employeeId,
        input.toResortId,
        input.toDepartmentId ?? null,
        input.designation ?? employee.designation,
        input.transferDate,
        input.reason ?? null,
      ]
    );

    await conn.execute(
      `UPDATE employees SET current_resort_id = ?, department_id = COALESCE(?, department_id),
        designation = COALESCE(?, designation) WHERE id = ?`,
      [input.toResortId, input.toDepartmentId ?? null, input.designation ?? null, employeeId]
    );

    await conn.execute(
      `INSERT INTO employee_transfers (
        id, employee_id, from_resort_id, to_resort_id, from_department_id, to_department_id,
        transfer_date, reason, approved_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [
        transferId,
        employeeId,
        employee.current_resort_id,
        input.toResortId,
        employee.department_id,
        input.toDepartmentId ?? null,
        input.transferDate,
        input.reason ?? null,
        actorUserId,
      ]
    );
  });

  await writeAuditLog({
    actorUserId,
    action: 'employee.transfer',
    entityType: 'employee',
    entityId: employeeId,
    resortId: input.toResortId,
    beforeData: { resortId: employee.current_resort_id },
    afterData: { resortId: input.toResortId, transferDate: input.transferDate },
  });

  return getEmployeeById(employeeId);
}

export async function updateEmployeeDepartment(
  employeeId: string,
  departmentName: string,
  actorUserId: string
) {
  const employee = await getEmployeeById(employeeId);
  const departmentId = await resolveDepartment(null, departmentName);
  await execute(`UPDATE employees SET department_id = :departmentId WHERE id = :id`, {
    id: employeeId,
    departmentId,
  });
  await execute(
    `UPDATE employee_postings SET department_id = :departmentId
     WHERE employee_id = :id AND is_current = 1`,
    { id: employeeId, departmentId }
  );
  await writeAuditLog({
    actorUserId,
    action: 'employee.department',
    entityType: 'employee',
    entityId: employeeId,
    resortId: employee.current_resort_id,
    beforeData: { departmentId: employee.department_id },
    afterData: { departmentId, departmentName: departmentName.trim() },
  });
  return getEmployeeById(employeeId);
}

export async function updateEmployeeFromReport(
  employeeId: string,
  patch: {
    firstName?: string;
    lastName?: string;
    departmentName?: string;
    designation?: string;
    gender?: 'male' | 'female' | 'other';
    shiftStart?: string;
    shiftEnd?: string;
  }
) {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: employeeId };
  if (patch.firstName) {
    sets.push('first_name = :firstName');
    params.firstName = patch.firstName.slice(0, 100);
  }
  if (patch.lastName) {
    sets.push('last_name = :lastName');
    params.lastName = patch.lastName.slice(0, 100);
  }
  if (patch.departmentName) {
    sets.push('department_id = :departmentId');
    params.departmentId = await resolveDepartment(null, patch.departmentName);
  }
  if (patch.designation) {
    sets.push('designation = :designation');
    params.designation = patch.designation.slice(0, 128);
  }
  if (patch.gender) {
    sets.push('gender = :gender');
    params.gender = patch.gender;
  }
  if (patch.shiftStart) {
    sets.push('shift_start = :shiftStart');
    params.shiftStart = normalizeTime(patch.shiftStart);
  }
  if (patch.shiftEnd) {
    sets.push('shift_end = :shiftEnd');
    params.shiftEnd = normalizeTime(patch.shiftEnd);
  }
  if (!sets.length) return;
  await execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = :id`, params);
  if (params.departmentId) {
    await execute(
      `UPDATE employee_postings SET department_id = :departmentId
       WHERE employee_id = :id AND is_current = 1`,
      { id: employeeId, departmentId: params.departmentId }
    );
  }
}

export async function updateEmployeeGender(
  employeeId: string,
  gender: 'male' | 'female' | 'other' | null,
  actorUserId: string
) {
  const employee = await getEmployeeById(employeeId);
  await execute(`UPDATE employees SET gender = :gender WHERE id = :id`, { id: employeeId, gender });
  await writeAuditLog({
    actorUserId,
    action: 'employee.gender',
    entityType: 'employee',
    entityId: employeeId,
    resortId: employee.current_resort_id,
    beforeData: { gender: employee.gender ?? null },
    afterData: { gender },
  });
}

export async function updateEmployee(
  employeeId: string,
  input: {
    firstName: string;
    lastName: string;
    departmentName?: string | null;
    designation?: string | null;
    gender?: 'male' | 'female' | 'other' | null;
    shiftStart?: string | null;
    shiftEnd?: string | null;
    currentResortId?: string | null;
  },
  actorUserId: string
) {
  const employee = await getEmployeeById(employeeId);
  if (input.currentResortId) {
    const resort = await query<RowDataPacket[]>(
      `SELECT id FROM resorts WHERE id = :id AND status = 'active' LIMIT 1`,
      { id: input.currentResortId }
    );
    if (!resort.length) throw new ValidationError('Invalid or inactive site');
  }
  const departmentId = input.departmentName ? await resolveDepartment(null, input.departmentName) : null;
  await execute(
    `UPDATE employees SET
      first_name = :firstName,
      last_name = :lastName,
      department_id = :departmentId,
      designation = :designation,
      gender = :gender,
      shift_start = :shiftStart,
      shift_end = :shiftEnd,
      current_resort_id = COALESCE(:resortId, current_resort_id)
     WHERE id = :id`,
    {
      id: employeeId,
      firstName: input.firstName.trim().slice(0, 100),
      lastName: input.lastName.trim().slice(0, 100),
      departmentId,
      designation: input.designation?.trim() || null,
      gender: input.gender ?? null,
      shiftStart: normalizeTime(input.shiftStart),
      shiftEnd: normalizeTime(input.shiftEnd),
      resortId: input.currentResortId ?? null,
    }
  );
  await execute(
    `UPDATE employee_postings SET
      department_id = :departmentId,
      designation = :designation,
      resort_id = COALESCE(:resortId, resort_id)
     WHERE employee_id = :id AND is_current = 1`,
    {
      id: employeeId,
      departmentId,
      designation: input.designation?.trim() || null,
      resortId: input.currentResortId ?? null,
    }
  );
  await writeAuditLog({
    actorUserId,
    action: 'employee.update',
    entityType: 'employee',
    entityId: employeeId,
    resortId: input.currentResortId ?? employee.current_resort_id,
    beforeData: {
      firstName: employee.first_name,
      lastName: employee.last_name,
      departmentId: employee.department_id,
    },
    afterData: input,
  });
  return getEmployeeById(employeeId);
}

export async function deactivateEmployee(employeeId: string, actorUserId: string) {
  const employee = await getEmployeeById(employeeId);
  await execute(`UPDATE employees SET status = 'inactive' WHERE id = :id`, { id: employeeId });
  await execute(`UPDATE device_employee_mappings SET is_active = 0 WHERE employee_id = :id`, { id: employeeId });
  await writeAuditLog({
    actorUserId,
    action: 'employee.delete',
    entityType: 'employee',
    entityId: employeeId,
    resortId: employee.current_resort_id,
    beforeData: { status: employee.status },
    afterData: { status: 'inactive' },
  });
}

export async function listDepartments() {
  return query<RowDataPacket[]>(
    `SELECT id, code, name, resort_id AS resortId, status
     FROM departments WHERE status = 'active' ORDER BY name`
  );
}

async function resolveDepartment(departmentId?: string | null, departmentName?: string | null) {
  if (departmentId) return departmentId;
  const name = departmentName?.trim();
  if (!name) return null;
  const existing = await query<RowDataPacket[]>(
    `SELECT id FROM departments WHERE name = :name LIMIT 1`,
    { name }
  );
  if (existing.length) return String(existing[0].id);
  const id = randomUUID();
  const base = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'DEPT';
  const code = `${base}_${id.slice(0, 6).toUpperCase()}`;
  await execute(`INSERT INTO departments (id, code, name) VALUES (:id, :code, :name)`, { id, code, name });
  return id;
}

function normalizeTime(value?: string | null) {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}
