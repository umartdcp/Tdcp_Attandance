import { ValidationError } from '../utils/errors';
import { GenericCsvAdapter } from './generic-csv';
import { ScaffoldAdapter } from './scaffold';
import { AdapterInfo, AttendanceDeviceAdapter } from './types';
import { ZktecoPullAdapter } from './zkteco-pull';

const CATALOG: AdapterInfo[] = [
  {
    code: 'generic_csv',
    manufacturer: 'Generic',
    verified: true,
    notes: 'Offline CSV/JSON punch import. Idempotent on device id + source record id.',
  },
  {
    code: 'zkteco_pull',
    manufacturer: 'ZKTeco',
    verified: false,
    notes: 'TCP reachability on port 4370 is implemented. Attendance log protocol is not verified.',
  },
  {
    code: 'hikvision',
    manufacturer: 'Hikvision',
    verified: false,
    notes: 'Scaffold only — not implemented.',
  },
  {
    code: 'suprema',
    manufacturer: 'Suprema',
    verified: false,
    notes: 'Scaffold only — not implemented.',
  },
  {
    code: 'anviz',
    manufacturer: 'Anviz',
    verified: false,
    notes: 'Scaffold only — not implemented.',
  },
];

export function listSupportedAdapters(): AdapterInfo[] {
  return CATALOG.map((item) => ({ ...item }));
}

export function createAdapter(
  code: string,
  connectionConfig: Record<string, unknown> = {},
  options?: { csvRecords?: unknown[] }
): AttendanceDeviceAdapter {
  const info = CATALOG.find((item) => item.code === code);
  if (!info) throw new ValidationError(`Unknown adapter code: ${code}`);

  if (code === 'generic_csv') {
    return new GenericCsvAdapter(connectionConfig, options?.csvRecords ?? []);
  }
  if (code === 'zkteco_pull') {
    return new ZktecoPullAdapter(connectionConfig);
  }
  return new ScaffoldAdapter(info);
}
