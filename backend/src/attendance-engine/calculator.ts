import {
  DailyAttendanceResult,
  NormalizedAttendanceRecord,
  ShiftWindow,
  AttendanceStatus,
} from './types';

const TZ = 'Asia/Karachi';

/** Format a Date as YYYY-MM-DD in Asia/Karachi */
export function toBusinessDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseTimeOnDate(dateStr: string, time: string): Date {
  // Interpret wall-clock time in Asia/Karachi as UTC+5
  return new Date(`${dateStr}T${time}+05:00`);
}

function dayOfWeekKarachi(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+05:00`);
  return d.getUTCDay(); // still need local: use formatter
}

function karachiWeekday(dateStr: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const key = fmt.format(new Date(`${dateStr}T12:00:00+05:00`));
  return map[key] ?? dayOfWeekKarachi(dateStr);
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/**
 * Calculate daily attendance from normalized punch records for one employee/date.
 * Original biometric records must remain unchanged — this only produces derived daily rows.
 */
export function calculateDailyAttendance(params: {
  employeeId: string;
  attendanceDate: string;
  punches: NormalizedAttendanceRecord[];
  shift: ShiftWindow | null;
  isOnLeave?: boolean;
  isHoliday?: boolean;
}): DailyAttendanceResult {
  const { employeeId, attendanceDate, punches, shift, isOnLeave, isHoliday } = params;

  if (isHoliday) {
    return baseResult(employeeId, attendanceDate, shift?.id ?? null, 'holiday');
  }
  if (isOnLeave) {
    return baseResult(employeeId, attendanceDate, shift?.id ?? null, 'on_leave');
  }
  if (shift?.weeklyOffs?.includes(karachiWeekday(attendanceDate))) {
    return baseResult(employeeId, attendanceDate, shift.id, 'weekly_off');
  }

  const sorted = [...punches].sort(
    (a, b) => a.punchTime.getTime() - b.punchTime.getTime()
  );

  if (!sorted.length) {
    return baseResult(employeeId, attendanceDate, shift?.id ?? null, 'absent');
  }

  const checkIn = sorted[0].punchTime;
  const checkOut = sorted.length > 1 ? sorted[sorted.length - 1].punchTime : null;

  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;
  let status: AttendanceStatus = 'present';

  if (shift) {
    const shiftStart = parseTimeOnDate(attendanceDate, shift.startTime);
    let shiftEnd = parseTimeOnDate(attendanceDate, shift.endTime);
    if (shift.isOvernight) {
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const lateThreshold = new Date(shiftStart.getTime() + shift.graceLateMinutes * 60000);
    if (checkIn > lateThreshold) {
      lateMinutes = minutesBetween(shiftStart, checkIn);
      status = 'late';
    }

    if (!checkOut) {
      if (new Date() > shiftEnd) status = 'missing_punch';
    } else {
      const earlyThreshold = new Date(shiftEnd.getTime() - shift.graceEarlyMinutes * 60000);
      if (checkOut < earlyThreshold) {
        earlyDepartureMinutes = minutesBetween(checkOut, shiftEnd);
      }
    }
  } else if (!checkOut) {
    status = 'missing_punch';
  }

  const workingMinutes = checkOut ? minutesBetween(checkIn, checkOut) : null;

  return {
    employeeId,
    attendanceDate,
    shiftId: shift?.id ?? null,
    checkIn,
    checkOut,
    workingMinutes,
    lateMinutes,
    earlyDepartureMinutes,
    status,
  };
}

function baseResult(
  employeeId: string,
  attendanceDate: string,
  shiftId: string | null,
  status: AttendanceStatus
): DailyAttendanceResult {
  return {
    employeeId,
    attendanceDate,
    shiftId,
    checkIn: null,
    checkOut: null,
    workingMinutes: null,
    lateMinutes: 0,
    earlyDepartureMinutes: 0,
    status,
  };
}
