import { describe, expect, it } from 'vitest';
import { canonicalDepartment, clock, parseAttendanceMatrix } from './attendance-report.parse';

describe('attendance report parser', () => {
  it('reads a daily report under a title row', () => {
    const rows = parseAttendanceMatrix([
      ['TDCP Daily Attendance'],
      ['Date', '21/10/2026'],
      ['No.', 'User ID', 'Name', 'Department', 'Check In', 'Check Out', 'Late', 'Status'],
      ['1', '0013', 'Umar Imran', 'Administration', '8:40 AM', '5:10 PM', '0', 'Present'],
      ['2', '43', 'Umer Iqbal', 'HR', '10:13', '17:02', '74', 'Late'],
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      userId: '0013',
      name: 'Umar Imran',
      department: 'Admin',
      checkIn: '08:40:00',
      checkOut: '17:10:00',
      lateMinutes: 0,
      status: 'Present',
    });
    expect(rows[1].department).toBe('HR');
    expect(rows[1].checkIn).toBe('10:13:00');
    expect(rows[1].lateMinutes).toBe(74);
  });

  it('combines punch rows into check-in and check-out', () => {
    const rows = parseAttendanceMatrix([
      ['AC-No.', 'Name', 'Dept', 'Time', 'State'],
      ['9', 'UMAR KHAN', 'Finance', '09:01:00', 'In'],
      ['9', 'UMAR KHAN', 'Finance', '17:05:00', 'Out'],
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        userId: '9',
        department: 'Finance',
        checkIn: '09:01:00',
        checkOut: '17:05:00',
      }),
    ]);
  });

  it('ignores a blank clock time', () => {
    expect(clock('00:00')).toBe('');
    expect(clock('-')).toBe('');
    expect(canonicalDepartment('P & P')).toBe('P&P');
  });
});
