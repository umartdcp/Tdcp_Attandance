import express, { Request, Response, Router } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../config/database';
import { ingestNormalizedRecord, recalculateDailyAttendance, toBusinessDate } from '../attendance-engine';
import { PunchDirection } from '../attendance-engine/types';
import { logger } from '../utils/logger';

interface PushDevice {
  id: string;
  resortId: string;
  serialNumber: string | null;
  host: string;
  config: Record<string, unknown>;
}

const router = Router();
router.use(express.text({ type: () => true, limit: '8mb' }));

router.all('*', (req, res, next) => {
  void handleIclock(req, res).catch(next);
});

async function handleIclock(req: Request, res: Response): Promise<void> {
  const sn = String(req.query.SN ?? req.query.sn ?? '').trim();
  const table = String(req.query.table ?? '').toUpperCase();
  const ip = clientIp(req);
  const path = req.path.toLowerCase();
  const body = typeof req.body === 'string' ? req.body : '';

  logger.info(`iclock ${req.method} ${path} sn=${sn || '-'} ip=${ip} table=${table || '-'} bytes=${body.length}`);

  if (path.endsWith('/getrequest') || path.endsWith('/ping') || path.endsWith('/devicecmd')) {
    reply(res, 'OK');
    return;
  }

  const device = sn ? await findDevice(sn, ip) : null;

  if (path.endsWith('/cdata') && String(req.query.options ?? '') !== '' && req.method === 'GET') {
    if (device) await markOnline(device, sn, 0);
    const stamp = device ? Number(device.config.admsStamp ?? 0) || 0 : 0;
    reply(
      res,
      [
        `GET OPTION FROM: ${sn || 'TDCP'}`,
        `ATTLOGStamp=${stamp}`,
        `OPERLOGStamp=${stamp}`,
        'ATTPHOTOStamp=0',
        'ErrorDelay=60',
        'Delay=10',
        'TransTimes=00:00;14:00',
        'TransInterval=1',
        'TransFlag=TransData AttLog\tOpLog\tAttPhoto\tEnrollUser\tChgUser\tEnrollFP\tChgFP',
        'Realtime=1',
        'Encrypt=None',
        'TimeZone=5',
        'ServerVer=2.4.1',
      ].join('\n')
    );
    return;
  }

  if (path.endsWith('/cdata') && (table === 'ATTLOG' || looksLikeAttendance(body))) {
    if (!device) {
      logger.warn(`iclock attendance from ${ip} serial ${sn || '-'} did not match a registered machine`);
      reply(res, 'OK');
      return;
    }
    const imported = await importAttendance(device, sn, body);
    const stamp = Number(req.query.Stamp ?? req.query.stamp ?? device.config.admsStamp ?? 0) || 0;
    await markOnline(device, sn, imported, stamp);
    reply(res, 'OK');
    return;
  }

  if (device) await markOnline(device, sn, 0);
  reply(res, 'OK');
}

function reply(res: Response, body: string): void {
  res.status(200).type('text/plain').send(body);
}

function clientIp(req: Request): string {
  return (req.socket.remoteAddress ?? '').replace(/^::ffff:/, '');
}

function isOfficeIp(ip: string): boolean {
  return ip.startsWith('172.16.') || ip.startsWith('192.168.') || ip.startsWith('10.');
}

function configOf(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value as Record<string, unknown>;
}

async function loadPushDevices(): Promise<PushDevice[]> {
  const rows = await query<RowDataPacket[]>(
    `SELECT d.id, d.resort_id AS resortId, d.serial_number AS serialNumber,
            d.connection_config AS connectionConfig
     FROM attendance_devices d
     INNER JOIN device_adapters a ON a.id = d.adapter_id
     WHERE a.code = 'zkteco_pull'`
  );
  return rows.map((row) => {
    const config = configOf(row.connectionConfig);
    return {
      id: String(row.id),
      resortId: String(row.resortId),
      serialNumber: row.serialNumber ? String(row.serialNumber) : null,
      host: typeof config.host === 'string' ? config.host : '',
      config,
    };
  });
}

async function findDevice(sn: string, ip: string): Promise<PushDevice | null> {
  const devices = await loadPushDevices();
  const bySerial = devices.find(
    (device) => device.serialNumber && device.serialNumber.toLowerCase() === sn.toLowerCase()
  );
  if (bySerial) return bySerial;
  const byIp = devices.find((device) => device.host && device.host === ip);
  if (byIp) return byIp;
  if (devices.length === 1 && isOfficeIp(ip)) return devices[0];
  return null;
}

async function markOnline(device: PushDevice, sn: string, imported: number, stamp?: number): Promise<void> {
  const config = { ...device.config };
  if (stamp) config.admsStamp = stamp;
  await execute(
    `UPDATE attendance_devices
     SET status = 'online',
         last_error = NULL,
         last_sync_at = NOW(),
         serial_number = COALESCE(serial_number, :sn),
         connection_config = :config,
         total_imported_records = total_imported_records + :imported,
         last_attendance_at = CASE WHEN :imported > 0 THEN NOW() ELSE last_attendance_at END
     WHERE id = :id`,
    {
      id: device.id,
      sn: sn || null,
      config: JSON.stringify(config),
      imported,
    }
  );
}

function looksLikeAttendance(body: string): boolean {
  return /^\s*\S+\s+\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/m.test(body);
}

function parseDeviceTime(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 5, Number(minute), Number(second)));
}

function punchDirection(status: string): PunchDirection {
  const code = Number(status);
  if (code === 0 || code === 3 || code === 4) return 'in';
  if (code === 1 || code === 2 || code === 5) return 'out';
  return 'unknown';
}

function verificationMethod(code: string): string {
  const methods: Record<string, string> = {
    '0': 'password',
    '1': 'fingerprint',
    '2': 'card',
    '4': 'card',
    '15': 'face',
  };
  return methods[code] ?? 'device';
}

function parseLine(line: string): { pin: string; time: string; status: string; verify: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('OPLOG') || trimmed.startsWith('USER ')) return null;
  if (trimmed.includes('\t')) {
    const parts = trimmed.split('\t');
    if (parts.length < 2) return null;
    return { pin: parts[0].trim(), time: parts[1].trim(), status: parts[2] ?? '', verify: parts[3] ?? '' };
  }
  const match = trimmed.match(/^(\S+)\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})\s+(\d+)?\s*(\d+)?/);
  if (!match) return null;
  return { pin: match[1], time: match[2], status: match[3] ?? '', verify: match[4] ?? '' };
}

async function employeeIdFor(device: PushDevice, deviceUserId: string): Promise<string | null> {
  const mapped = await query<RowDataPacket[]>(
    `SELECT employee_id AS employeeId FROM device_employee_mappings
     WHERE device_id = :deviceId AND device_user_id = :uid AND is_active = 1 LIMIT 1`,
    { deviceId: device.id, uid: deviceUserId }
  );
  if (mapped.length) return String(mapped[0].employeeId);
  const enrolled = await query<RowDataPacket[]>(
    `SELECT id FROM employees
     WHERE current_resort_id = :resortId AND device_user_id = :uid LIMIT 1`,
    { resortId: device.resortId, uid: deviceUserId }
  );
  return enrolled.length ? String(enrolled[0].id) : null;
}

async function importAttendance(device: PushDevice, sn: string, body: string): Promise<number> {
  const touched = new Set<string>();
  let imported = 0;
  for (const line of body.split(/\r?\n/)) {
    const punch = parseLine(line);
    if (!punch?.pin) continue;
    const punchTime = parseDeviceTime(punch.time);
    if (!punchTime) continue;
    const employeeId = await employeeIdFor(device, punch.pin);
    const result = await ingestNormalizedRecord({
      employeeId,
      deviceUserId: punch.pin,
      deviceId: device.id,
      resortId: device.resortId,
      punchTime,
      punchDirection: punchDirection(punch.status),
      verificationMethod: verificationMethod(punch.verify),
      sourceRecordId: `${sn}|${punch.pin}|${punch.time}`,
      syncedAt: new Date(),
      sourcePayload: { line, serial: sn },
      processingStatus: 'pending',
    });
    if (result.inserted) {
      imported++;
      if (employeeId) touched.add(`${employeeId}|${toBusinessDate(punchTime)}`);
    }
  }
  for (const key of touched) {
    const splitAt = key.indexOf('|');
    await recalculateDailyAttendance(device.resortId, key.slice(0, splitAt), key.slice(splitAt + 1));
  }
  if (imported) logger.info(`iclock imported ${imported} punches from ${sn || device.host}`);
  return imported;
}

export default router;
