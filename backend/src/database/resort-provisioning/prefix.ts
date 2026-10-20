import { ValidationError } from '../../utils/errors';

/** Physical per-resort tables. Names are always `{prefix}_{suffix}`. */
export const TABLE_SUFFIXES = [
  'attendance_logs',
  'daily_attendance',
  'shift_assignments',
  'attendance_corrections',
  'leave_requests',
  'overtime_records',
] as const;

export type TableSuffix = (typeof TABLE_SUFFIXES)[number];
export type ResortTables = Record<TableSuffix, string>;

/** `tdcp_` + slug, capped so `{prefix}_attendance_corrections` stays under 64 chars. */
const PREFIX_PATTERN = /^tdcp_[a-z][a-z0-9_]{0,34}$/;

export function assertValidTablePrefix(prefix: string): void {
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new ValidationError('Invalid table prefix');
  }
}

export function codeToPrefix(code: string): string {
  const slug = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 35);

  if (!/^[a-z]/.test(slug)) {
    throw new ValidationError('Location code must start with a letter');
  }

  const prefix = `tdcp_${slug}`;
  assertValidTablePrefix(prefix);
  return prefix;
}

export function buildTableMap(prefix: string): ResortTables {
  assertValidTablePrefix(prefix);
  return {
    attendance_logs: `${prefix}_attendance_logs`,
    daily_attendance: `${prefix}_daily_attendance`,
    shift_assignments: `${prefix}_shift_assignments`,
    attendance_corrections: `${prefix}_attendance_corrections`,
    leave_requests: `${prefix}_leave_requests`,
    overtime_records: `${prefix}_overtime_records`,
  };
}
