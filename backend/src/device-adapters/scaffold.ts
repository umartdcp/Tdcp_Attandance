import { ValidationError } from '../utils/errors';
import { AdapterInfo, AttendanceDeviceAdapter } from './types';

/** Manufacturer scaffolds. Connection and log download are not implemented. */
export class ScaffoldAdapter implements AttendanceDeviceAdapter {
  constructor(private readonly info: AdapterInfo) {}

  getCapabilities() {
    return {
      testConnection: false,
      getDeviceInfo: false,
      fetchAttendanceLogs: false,
      csvImport: false,
    };
  }

  async testConnection(): Promise<boolean> {
    throw new ValidationError(`${this.info.manufacturer} adapter is not implemented`);
  }

  async getDeviceInfo(): Promise<Record<string, unknown>> {
    throw new ValidationError(`${this.info.manufacturer} adapter is not implemented`);
  }

  async fetchAttendanceLogs(): Promise<unknown[]> {
    throw new ValidationError(`${this.info.manufacturer} log download is not implemented`);
  }

  normalizeRecord(): never {
    throw new ValidationError(`${this.info.manufacturer} record normalization is not implemented`);
  }
}
