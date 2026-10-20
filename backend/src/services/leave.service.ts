import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query, execute, getPool } from '../config/database';
import { getResortTableMap } from '../database/resort-provisioning/provisioner';
import { assertValidTablePrefix } from '../database/resort-provisioning/prefix';
import { NotFoundError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './audit.service';

export async function listLeaveTypes() {
  return query<RowDataPacket[]>(
    `SELECT id, code, name, is_paid AS isPaid, requires_approval AS requiresApproval,
            max_days_per_year AS maxDaysPerYear, status
     FROM leave_types WHERE status = 'active' ORDER BY name`
  );
}

export async function getBalances(employeeId: string, year?: number) {
  const y = year ?? new Date().getFullYear();
  return query<RowDataPacket[]>(
    `SELECT lb.id, lb.year, lb.entitled, lb.used, lb.pending,
            lt.code AS leaveTypeCode, lt.name AS leaveTypeName
     FROM leave_balances lb
     INNER JOIN leave_types lt ON lt.id = lb.leave_type_id
     WHERE lb.employee_id = :employeeId AND lb.year = :year`,
    { employeeId, year: y }
  );
}

export async function applyLeave(
  input: {
    employeeId: string;
    resortId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    days: number;
    reason?: string | null;
  },
  actorUserId: string
) {
  if (input.days <= 0) throw new ValidationError('days must be positive');
  const tables = await getResortTableMap(input.resortId);
  assertValidTablePrefix(tables.leave_requests.replace(/_leave_requests$/, ''));
  const id = randomUUID();
  const pool = getPool();
  await pool.execute(
    `INSERT INTO \`${tables.leave_requests}\` (
      id, employee_id, leave_type_id, start_date, end_date, days, reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      input.employeeId,
      input.leaveTypeId,
      input.startDate,
      input.endDate,
      input.days,
      input.reason ?? null,
    ]
  );

  await execute(
    `UPDATE leave_balances
     SET pending = pending + :days
     WHERE employee_id = :employeeId AND leave_type_id = :leaveTypeId
       AND year = YEAR(:startDate)`,
    {
      days: input.days,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
    }
  );

  await writeAuditLog({
    actorUserId,
    action: 'leave.apply',
    entityType: 'leave_request',
    entityId: id,
    resortId: input.resortId,
    afterData: input,
  });

  return { id, status: 'pending' };
}

export async function reviewLeave(
  input: {
    resortId: string;
    leaveRequestId: string;
    status: 'approved' | 'rejected';
    reviewNotes?: string | null;
  },
  actorUserId: string
) {
  const tables = await getResortTableMap(input.resortId);
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM \`${tables.leave_requests}\` WHERE id = ? LIMIT 1`,
    [input.leaveRequestId]
  );
  if (!rows.length) throw new NotFoundError('Leave request not found');
  const req = rows[0];
  if (req.status !== 'pending') throw new ValidationError('Leave request is not pending');

  await pool.execute(
    `UPDATE \`${tables.leave_requests}\`
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
     WHERE id = ?`,
    [input.status, actorUserId, input.reviewNotes ?? null, input.leaveRequestId]
  );

  if (input.status === 'approved') {
    await execute(
      `UPDATE leave_balances
       SET pending = GREATEST(pending - :days, 0), used = used + :days
       WHERE employee_id = :employeeId AND leave_type_id = :leaveTypeId
         AND year = YEAR(:startDate)`,
      {
        days: Number(req.days),
        employeeId: req.employee_id,
        leaveTypeId: req.leave_type_id,
        startDate: req.start_date,
      }
    );
  } else {
    await execute(
      `UPDATE leave_balances
       SET pending = GREATEST(pending - :days, 0)
       WHERE employee_id = :employeeId AND leave_type_id = :leaveTypeId
         AND year = YEAR(:startDate)`,
      {
        days: Number(req.days),
        employeeId: req.employee_id,
        leaveTypeId: req.leave_type_id,
        startDate: req.start_date,
      }
    );
  }

  await writeAuditLog({
    actorUserId,
    action: `leave.${input.status}`,
    entityType: 'leave_request',
    entityId: input.leaveRequestId,
    resortId: input.resortId,
  });

  return { id: input.leaveRequestId, status: input.status };
}
