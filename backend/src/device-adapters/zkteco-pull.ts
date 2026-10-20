import net from 'net';
import { ValidationError } from '../utils/errors';
import { AttendanceDeviceAdapter } from './types';

/**
 * ZKTeco pull adapter. TCP reachability on the device port is implemented.
 * The attendance log protocol is intentionally not implemented until it is
 * tested against the TDCP devices on site.
 */
export class ZktecoPullAdapter implements AttendanceDeviceAdapter {
  constructor(private readonly config: Record<string, unknown>) {}

  getCapabilities() {
    return {
      testConnection: true,
      getDeviceInfo: true,
      fetchAttendanceLogs: false,
      csvImport: false,
    };
  }

  async testConnection(): Promise<boolean> {
    const host = typeof this.config.host === 'string' ? this.config.host : '';
    const port = Number(this.config.port ?? 4370);
    if (!host || !Number.isFinite(port)) return false;

    return new Promise((resolve) => {
      const socket = net.connect({ host, port, timeout: 4000 });
      const done = (ok: boolean) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(ok);
      };
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });
  }

  async getDeviceInfo(): Promise<Record<string, unknown>> {
    const reachable = await this.testConnection();
    return {
      manufacturer: 'ZKTeco',
      reachable,
      note: 'Full device info requires the attendance protocol, which is not verified yet.',
    };
  }

  async fetchAttendanceLogs(): Promise<unknown[]> {
    throw new ValidationError(
      'ZKTeco log download is not enabled. TCP reachability is implemented; the attendance protocol is pending on-site verification.'
    );
  }

  normalizeRecord(): never {
    throw new ValidationError('ZKTeco record normalization is not verified yet. Use CSV import.');
  }
}
