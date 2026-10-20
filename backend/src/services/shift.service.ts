import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../config/database';

export async function listShifts(resortId?: string) {
  if (resortId) {
    return query<RowDataPacket[]>(
      `SELECT id, code, name, shift_type AS shiftType, start_time AS startTime, end_time AS endTime,
              is_overnight AS isOvernight, grace_late_minutes AS graceLateMinutes,
              grace_early_minutes AS graceEarlyMinutes, weekly_offs AS weeklyOffs, status, resort_id AS resortId
       FROM shifts
       WHERE status = 'active' AND (resort_id IS NULL OR resort_id = :resortId)
       ORDER BY start_time`,
      { resortId }
    );
  }
  return query<RowDataPacket[]>(
    `SELECT id, code, name, shift_type AS shiftType, start_time AS startTime, end_time AS endTime,
            is_overnight AS isOvernight, grace_late_minutes AS graceLateMinutes,
            grace_early_minutes AS graceEarlyMinutes, weekly_offs AS weeklyOffs, status, resort_id AS resortId
     FROM shifts WHERE status = 'active' ORDER BY start_time`
  );
}

export async function createShift(input: {
  resortId?: string | null;
  code: string;
  name: string;
  shiftType: string;
  startTime: string;
  endTime: string;
  isOvernight?: boolean;
  graceLateMinutes?: number;
  graceEarlyMinutes?: number;
  weeklyOffs?: number[];
}) {
  const id = randomUUID();
  await execute(
    `INSERT INTO shifts (
      id, resort_id, code, name, shift_type, start_time, end_time, is_overnight,
      grace_late_minutes, grace_early_minutes, weekly_offs, status
    ) VALUES (
      :id, :resortId, :code, :name, :shiftType, :startTime, :endTime, :isOvernight,
      :graceLate, :graceEarly, :weeklyOffs, 'active'
    )`,
    {
      id,
      resortId: input.resortId ?? null,
      code: input.code,
      name: input.name,
      shiftType: input.shiftType,
      startTime: input.startTime,
      endTime: input.endTime,
      isOvernight: input.isOvernight ? 1 : 0,
      graceLate: input.graceLateMinutes ?? 15,
      graceEarly: input.graceEarlyMinutes ?? 15,
      weeklyOffs: JSON.stringify(input.weeklyOffs ?? [0]),
    }
  );
  return { id };
}
