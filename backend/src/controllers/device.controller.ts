import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../config/database';
import { createAdapter, listSupportedAdapters } from '../device-adapters/registry';
import { assertLocationAccess } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../utils/errors';
import { sendSuccess } from '../utils/response';
import { writeAuditLog } from '../services/audit.service';
import { ingestNormalizedRecord, recalculateDailyAttendance, toBusinessDate } from '../attendance-engine';
import { paramId } from '../utils/params';
import { officeLanAddress } from '../utils/office-address';
import { env } from '../config/env';
import { syncZktecoDevice } from '../services/zk-sync.service';

export async function connectInfo(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, { host: officeLanAddress(), port: env.port });
  } catch (error) {
    next(error);
  }
}

export async function listAdapters(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    sendSuccess(res, listSupportedAdapters());
  } catch (error) {
    next(error);
  }
}

export async function listDevices(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const params: Record<string, unknown> = {};
    let where = 'WHERE 1=1';
    if (req.query.resortId) {
      assertLocationAccess(req.user!, String(req.query.resortId));
      where += ' AND d.resort_id = :resortId';
      params.resortId = req.query.resortId;
    } else if (
      req.user!.roleCode !== 'SUPER_ADMIN' &&
      req.user!.roleCode !== 'HO_HR_ADMIN'
    ) {
      if (!req.user!.locationIds.length) {
        sendSuccess(res, []);
        return;
      }
      where += ` AND d.resort_id IN (${req.user!.locationIds.map((_, i) => `:loc${i}`).join(',')})`;
      req.user!.locationIds.forEach((id, i) => {
        params[`loc${i}`] = id;
      });
    }
    if (req.query.status) {
      where += ' AND d.status = :status';
      params.status = req.query.status;
    }
    if (req.query.search) {
      where += ' AND (d.name LIKE :search OR d.serial_number LIKE :search OR r.name LIKE :search)';
      params.search = `%${String(req.query.search)}%`;
    }

    const rows = await query<RowDataPacket[]>(
      `SELECT d.id, d.name, d.serial_number AS serialNumber, d.connection_method AS connectionMethod,
              d.status, d.last_sync_at AS lastSyncAt, d.last_attendance_at AS lastAttendanceAt,
              d.total_imported_records AS totalImportedRecords, d.last_error AS lastError,
              d.resort_id AS resortId, r.name AS resortName,
              JSON_UNQUOTE(JSON_EXTRACT(d.connection_config, '$.host')) AS host,
              JSON_UNQUOTE(JSON_EXTRACT(d.connection_config, '$.port')) AS port,
              a.code AS adapterCode, a.manufacturer
       FROM attendance_devices d
       INNER JOIN resorts r ON r.id = d.resort_id
       INNER JOIN device_adapters a ON a.id = d.adapter_id
       ${where}
       ORDER BY d.name`,
      params
    );
    sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

export async function createDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { resortId, adapterCode, name, serialNumber, connectionMethod, connectionConfig } =
      req.body;
    assertLocationAccess(req.user!, resortId);

    const adapters = await query<RowDataPacket[]>(
      `SELECT id FROM device_adapters WHERE code = :code LIMIT 1`,
      { code: adapterCode }
    );
    if (!adapters.length) throw new ValidationError('Unknown adapter code');

    const id = randomUUID();
    await execute(
      `INSERT INTO attendance_devices (
        id, resort_id, adapter_id, name, serial_number, connection_method, connection_config, status
      ) VALUES (:id, :resortId, :adapterId, :name, :serialNumber, :connectionMethod, :connectionConfig, 'unknown')`,
      {
        id,
        resortId,
        adapterId: adapters[0].id,
        name,
        serialNumber: serialNumber ?? null,
        connectionMethod,
        connectionConfig: JSON.stringify(connectionConfig ?? {}),
      }
    );

    await writeAuditLog({
      actorUserId: req.user!.id,
      action: 'device.create',
      entityType: 'attendance_device',
      entityId: id,
      resortId,
      afterData: { name, adapterCode },
    });

    sendSuccess(res, { id }, 201);
  } catch (error) {
    next(error);
  }
}

export async function nextUserId(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    const mapped = await query<RowDataPacket[]>(
      `SELECT MAX(CAST(device_user_id AS UNSIGNED)) AS maxId
       FROM device_employee_mappings WHERE device_id = :deviceId`,
      { deviceId: device.id }
    );
    const enrolled = await query<RowDataPacket[]>(
      `SELECT MAX(CAST(device_user_id AS UNSIGNED)) AS maxId
       FROM employees
       WHERE current_resort_id = :resortId AND device_user_id REGEXP '^[0-9]+$'`,
      { resortId: device.resortId }
    );
    const maxId = Math.max(Number(mapped[0]?.maxId ?? 0), Number(enrolled[0]?.maxId ?? 0));
    let deviceOnline = false;
    const adapter = createAdapter(device.adapterCode, device.connectionConfig ?? {});
    if (adapter.getCapabilities().testConnection) {
      deviceOnline = await adapter.testConnection();
    }
    sendSuccess(res, {
      userId: String(maxId + 1),
      deviceOnline,
      source: deviceOnline ? 'device' : 'registry',
    });
  } catch (error) {
    next(error);
  }
}

export async function captureFinger(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    if (device.adapterCode === 'generic_csv') {
      throw new ValidationError('CSV import does not capture a fingerprint. Select a biometric machine.');
    }
    const adapter = createAdapter(device.adapterCode, device.connectionConfig ?? {});
    if (!adapter.getCapabilities().testConnection) {
      throw new ValidationError('This machine cannot capture a finger from the server');
    }
    const deviceOnline = await adapter.testConnection();
    if (!deviceOnline) {
      throw new ValidationError('Attendance machine is offline. Connect it on the office network, then capture the finger.');
    }
    sendSuccess(res, {
      captured: true,
      storedCentrally: false,
      message: 'Machine is online. The fingerprint stays on the device and is not copied into this system.',
    });
  } catch (error) {
    next(error);
  }
}

export async function testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    const adapter = createAdapter(device.adapterCode, device.connectionConfig);
    if (!adapter.getCapabilities().testConnection) {
      throw new ValidationError('This adapter does not support connection testing');
    }
    const ok = await adapter.testConnection();
    const softwareHost = officeLanAddress();
    const machineHost = typeof device.connectionConfig?.host === 'string' ? device.connectionConfig.host : 'the machine';
    const machinePort = device.connectionConfig?.port ?? 4370;
    const message = ok
      ? 'Machine is reachable on the office network.'
      : `This software cannot open ${machineHost} port ${machinePort}. On the attendance machine open Menu, Comm, Cloud Server Setting. Set the server address to ${softwareHost} and the server port to ${env.port}, then save. The machine connects to this software.`;
    await execute(
      `UPDATE attendance_devices SET status = :status, last_error = :err WHERE id = :id`,
      {
        id: device.id,
        status: ok ? 'online' : 'offline',
        err: ok ? null : message,
      }
    );
    sendSuccess(res, { connected: ok, message });
  } catch (error) {
    next(error);
  }
}

export async function syncDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    const result = await syncZktecoDevice(device.id);
    sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
}

export async function importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    const records = req.body.records as unknown[];
    if (!Array.isArray(records) || !records.length) {
      throw new ValidationError('records array is required');
    }

    const adapter = createAdapter('generic_csv', {}, { csvRecords: records });
    let imported = 0;
    let duplicates = 0;
    const touched = new Set<string>();

    for (const raw of records) {
      const normalized = adapter.normalizeRecord(raw, {
        deviceId: device.id,
        resortId: device.resortId,
      });
      if (normalized.deviceUserId) {
        const maps = await query<RowDataPacket[]>(
          `SELECT employee_id AS employeeId FROM device_employee_mappings
           WHERE device_id = :deviceId AND device_user_id = :uid AND is_active = 1 LIMIT 1`,
          { deviceId: device.id, uid: normalized.deviceUserId }
        );
        if (maps.length) normalized.employeeId = maps[0].employeeId;
      }
      const result = await ingestNormalizedRecord(normalized);
      if (result.inserted) {
        imported++;
        if (normalized.employeeId) {
          touched.add(`${normalized.employeeId}|${toBusinessDate(normalized.punchTime)}`);
        }
      } else {
        duplicates++;
      }
    }

    for (const key of touched) {
      const splitAt = key.indexOf('|');
      const employeeId = key.slice(0, splitAt);
      const attendanceDate = key.slice(splitAt + 1);
      await recalculateDailyAttendance(device.resortId, employeeId, attendanceDate);
    }

    await execute(
      `UPDATE attendance_devices
       SET total_imported_records = total_imported_records + :imported,
           last_sync_at = NOW(), last_attendance_at = NOW(), status = 'online'
       WHERE id = :id`,
      { imported, id: device.id }
    );

    const syncId = randomUUID();
    await execute(
      `INSERT INTO device_sync_logs (
        id, device_id, sync_type, status, records_fetched, records_imported, duplicates_skipped, finished_at
      ) VALUES (:id, :deviceId, 'manual', 'success', :fetched, :imported, :dupes, NOW())`,
      {
        id: syncId,
        deviceId: device.id,
        fetched: records.length,
        imported,
        dupes: duplicates,
      }
    );

    sendSuccess(res, { imported, duplicates, fetched: records.length });
  } catch (error) {
    next(error);
  }
}

async function loadDevice(id: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT d.id, d.resort_id AS resortId, d.connection_config AS connectionConfig,
            a.code AS adapterCode
     FROM attendance_devices d
     INNER JOIN device_adapters a ON a.id = d.adapter_id
     WHERE d.id = :id LIMIT 1`,
    { id }
  );
  if (!rows.length) throw new NotFoundError('Device not found');
  const config =
    typeof rows[0].connectionConfig === 'string'
      ? JSON.parse(rows[0].connectionConfig)
      : rows[0].connectionConfig;
  return {
    id: rows[0].id as string,
    resortId: rows[0].resortId as string,
    adapterCode: rows[0].adapterCode as string,
    connectionConfig: config,
  };
}
