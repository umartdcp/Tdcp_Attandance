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
  currentResortId: string;
  hireDate?: string | null;
}

export async function listEmployees(filters: {
  resortId?: string | null;
  locationIds?: string[] | null;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(1, filters.limit ?? 20), 100);
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
  if (filters.search) {
    clauses.push(
      `(e.employee_code LIKE :search OR e.first_name LIKE :search OR e.last_name LIKE :search OR e.email LIKE :search)`
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
            e.designation, e.email, e.phone, e.status, e.current_resort_id AS currentResortId,
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

  await withTransaction(async (conn) => {
    await conn.execute(
      `INSERT INTO employees (
        id, employee_code, first_name, last_name, father_name, cnic, email, phone,
        designation, department_id, current_resort_id, hire_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        id,
        code,
        input.firstName.trim(),
        input.lastName.trim(),
        input.fatherName ?? null,
        input.cnic ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.designation ?? null,
        input.departmentId ?? null,
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
        input.departmentId ?? null,
        input.designation ?? null,
        input.hireDate ?? null,
      ]
    );
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
