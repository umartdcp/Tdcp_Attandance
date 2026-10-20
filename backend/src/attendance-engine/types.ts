export type PunchDirection = 'in' | 'out' | 'unknown';
export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'half_day'
  | 'on_leave'
  | 'holiday'
  | 'weekly_off'
  | 'missing_punch'
  | 'excused';

export interface NormalizedAttendanceRecord {
  employeeId?: string | null;
  deviceUserId?: string | null;
  deviceId: string;
  resortId: string;
  punchTime: Date;
  punchDirection: PunchDirection;
  verificationMethod?: string | null;
  sourceRecordId?: string | null;
  syncedAt: Date;
  sourcePayload: unknown;
  processingStatus: 'pending' | 'processed' | 'failed' | 'duplicate';
}

export interface ShiftWindow {
  id: string;
  startTime: string; // HH:mm:ss
  endTime: string;
  isOvernight: boolean;
  graceLateMinutes: number;
  graceEarlyMinutes: number;
  weeklyOffs: number[]; // 0=Sunday
}

export interface DailyAttendanceResult {
  employeeId: string;
  attendanceDate: string;
  shiftId: string | null;
  checkIn: Date | null;
  checkOut: Date | null;
  workingMinutes: number | null;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  status: AttendanceStatus;
}
