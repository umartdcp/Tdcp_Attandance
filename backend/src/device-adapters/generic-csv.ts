import { ValidationError } from '../utils/errors';
import { AdapterContext, AttendanceDeviceAdapter, asPunchDirection } from './types';
import { NormalizedAttendanceRecord } from '../attendance-engine/types';

/**
 * Offline CSV / JSON import. This is the verified path for devices that can
 * export attendance punches. It does not open a network connection.
 */
export class GenericCsvAdapter implements AttendanceDeviceAdapter {
  constructor(
    private readonly config: Record<string, unknown> = {},
    private readonly csvRecords: unknown[] = []
  ) {}

  getCapabilities() {
    return {
      testConnection: true,
      getDeviceInfo: true,
      fetchAttendanceLogs: false,
      csvImport: true,
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async getDeviceInfo(): Promise<Record<string, unknown>> {
    return {
      manufacturer: 'Generic',
      model: 'CSV import',
      recordCount: this.csvRecords.length,
      delimiter: this.config.delimiter ?? ',',
    };
  }

  async fetchAttendanceLogs(): Promise<unknown[]> {
    if (this.csvRecords.length) return this.csvRecords;
    throw new ValidationError('CSV adapter does not pull live device logs. Post records to import-csv.');
  }

  normalizeRecord(raw: unknown, ctx: AdapterContext): NormalizedAttendanceRecord {
    if (!raw || typeof raw !== 'object') {
      throw new ValidationError('Each CSV record must be an object');
    }
    const row = raw as Record<string, unknown>;
    const deviceUserId = String(row.deviceUserId ?? row.userId ?? row.employeeCode ?? '').trim();
    const punchRaw = row.punchTime ?? row.timestamp ?? row.datetime;
    if (!punchRaw) throw new ValidationError('punchTime is required on each record');
    const punchTime = new Date(String(punchRaw));
    if (Number.isNaN(punchTime.getTime())) {
      throw new ValidationError(`Invalid punchTime: ${String(punchRaw)}`);
    }
    const sourceRecordId = String(
      row.sourceRecordId ?? row.id ?? `${deviceUserId}|${punchTime.toISOString()}`
    );
    return {
      employeeId: null,
      deviceUserId: deviceUserId || null,
      deviceId: ctx.deviceId,
      resortId: ctx.resortId,
      punchTime,
      punchDirection: asPunchDirection(row.punchDirection ?? row.direction),
      verificationMethod: row.verificationMethod ? String(row.verificationMethod) : 'csv',
      sourceRecordId,
      syncedAt: new Date(),
      sourcePayload: row,
      processingStatus: 'pending',
    };
  }
}
