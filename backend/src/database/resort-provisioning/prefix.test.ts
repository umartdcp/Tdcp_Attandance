import { describe, expect, it } from 'vitest';
import { assertValidTablePrefix, buildTableMap, codeToPrefix } from './prefix';
import { ValidationError } from '../../utils/errors';

describe('table prefix registry', () => {
  it('builds a safe prefix from a location code', () => {
    expect(codeToPrefix('PATRIATA')).toBe('tdcp_patriata');
    expect(codeToPrefix('Head Office Lahore')).toBe('tdcp_head_office_lahore');
  });

  it('strips characters that are not valid in SQL identifiers', () => {
    expect(codeToPrefix("Changa-Manga'; DROP TABLE users;--")).toBe('tdcp_changa_manga_drop_table_users');
  });

  it('rejects codes that cannot form a prefix', () => {
    expect(() => codeToPrefix('123')).toThrow(ValidationError);
    expect(() => codeToPrefix('___')).toThrow(ValidationError);
    expect(() => assertValidTablePrefix('users')).toThrow(ValidationError);
    expect(() => assertValidTablePrefix('tdcp_Bad')).toThrow(ValidationError);
  });

  it('names every resort table from the prefix', () => {
    const tables = buildTableMap('tdcp_patriata');
    expect(tables.attendance_logs).toBe('tdcp_patriata_attendance_logs');
    expect(tables.daily_attendance).toBe('tdcp_patriata_daily_attendance');
    expect(tables.leave_requests).toBe('tdcp_patriata_leave_requests');
    expect(tables.overtime_records).toBe('tdcp_patriata_overtime_records');
  });
});
