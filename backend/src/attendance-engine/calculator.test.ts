import { describe, expect, it } from 'vitest';
import { calculateDailyAttendance } from './calculator';
import { NormalizedAttendanceRecord, ShiftWindow } from './types';

const shift: ShiftWindow = {
  id: 'shift-general',
  startTime: '09:00:00',
  endTime: '17:00:00',
  isOvernight: false,
  graceLateMinutes: 15,
  graceEarlyMinutes: 15,
  weeklyOffs: [0],
};

function punch(time: string, direction: 'in' | 'out' | 'unknown' = 'unknown'): NormalizedAttendanceRecord {
  return {
    deviceId: 'device-1',
    resortId: 'resort-1',
    punchTime: new Date(time),
    punchDirection: direction,
    syncedAt: new Date(time),
    sourcePayload: {},
    processingStatus: 'pending',
  };
}

describe('calculateDailyAttendance', () => {
  it('marks a day with no punches as absent', () => {
    const result = calculateDailyAttendance({
      employeeId: 'emp-1',
      attendanceDate: '2026-10-19',
      punches: [],
      shift,
    });
    expect(result.status).toBe('absent');
    expect(result.checkIn).toBeNull();
  });

  it('marks a punch inside the grace window as present', () => {
    const result = calculateDailyAttendance({
      employeeId: 'emp-1',
      attendanceDate: '2026-10-19',
      punches: [punch('2026-10-19T09:10:00+05:00', 'in'), punch('2026-10-19T17:05:00+05:00', 'out')],
      shift,
    });
    expect(result.status).toBe('present');
    expect(result.lateMinutes).toBe(0);
    expect(result.workingMinutes).toBe(475);
  });

  it('marks arrival after grace as late', () => {
    const result = calculateDailyAttendance({
      employeeId: 'emp-1',
      attendanceDate: '2026-10-19',
      punches: [punch('2026-10-19T09:40:00+05:00', 'in'), punch('2026-10-19T17:10:00+05:00', 'out')],
      shift,
    });
    expect(result.status).toBe('late');
    expect(result.lateMinutes).toBe(40);
  });

  it('marks a single punch as missing checkout', () => {
    const result = calculateDailyAttendance({
      employeeId: 'emp-1',
      attendanceDate: '2026-10-19',
      punches: [punch('2026-10-19T09:00:00+05:00', 'in')],
      shift,
    });
    expect(result.status).toBe('missing_punch');
    expect(result.checkOut).toBeNull();
  });

  it('respects weekly off, leave, and holiday before punches', () => {
    expect(
      calculateDailyAttendance({
        employeeId: 'emp-1',
        attendanceDate: '2026-10-18',
        punches: [],
        shift,
      }).status
    ).toBe('weekly_off');

    expect(
      calculateDailyAttendance({
        employeeId: 'emp-1',
        attendanceDate: '2026-10-19',
        punches: [],
        shift,
        isOnLeave: true,
      }).status
    ).toBe('on_leave');

    expect(
      calculateDailyAttendance({
        employeeId: 'emp-1',
        attendanceDate: '2026-10-19',
        punches: [punch('2026-10-19T09:00:00+05:00')],
        shift,
        isHoliday: true,
      }).status
    ).toBe('holiday');
  });
});
