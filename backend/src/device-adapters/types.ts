import { NormalizedAttendanceRecord, PunchDirection } from '../attendance-engine/types';

export interface AdapterContext {
  deviceId: string;
  resortId: string;
}

export interface AdapterCapabilities {
  testConnection: boolean;
  getDeviceInfo: boolean;
  fetchAttendanceLogs: boolean;
  csvImport: boolean;
}

export interface AdapterInfo {
  code: string;
  manufacturer: string;
  verified: boolean;
  notes: string;
}

export interface AttendanceDeviceAdapter {
  testConnection(): Promise<boolean>;
  getDeviceInfo(): Promise<Record<string, unknown>>;
  fetchAttendanceLogs(cursor?: string): Promise<unknown[]>;
  normalizeRecord(raw: unknown, ctx: AdapterContext): NormalizedAttendanceRecord;
  getCapabilities(): AdapterCapabilities;
}

export function asPunchDirection(value: unknown): PunchDirection {
  const raw = String(value ?? 'unknown').toLowerCase();
  if (raw === 'in' || raw === 'checkin' || raw === 'check-in') return 'in';
  if (raw === 'out' || raw === 'checkout' || raw === 'check-out') return 'out';
  return 'unknown';
}
