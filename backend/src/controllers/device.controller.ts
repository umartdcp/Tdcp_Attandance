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

    const rows = await query<RowDataPacket[]>(
      `SELECT d.id, d.name, d.serial_number AS serialNumber, d.connection_method AS connectionMethod,
              d.status, d.last_sync_at AS lastSyncAt, d.last_attendance_at AS lastAttendanceAt,
              d.total_imported_records AS totalImportedRecords, d.last_error AS lastError,
              d.resort_id AS resortId, r.name AS resortName,
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

export async function testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await loadDevice(paramId(req));
    assertLocationAccess(req.user!, device.resortId);
    const adapter = createAdapter(device.adapterCode, device.connectionConfig);
    if (!adapter.getCapabilities().testConnection) {
      throw new ValidationError('This adapter does not support connection testing');
    }
    const ok = await adapter.testConnection();
    await execute(
      `UPDATE attendance_devices SET status = :status, last_error = :err WHERE id = :id`,
      {
        id: device.id,
        status: ok ? 'online' : 'offline',
        err: ok ? null : 'Connection test failed',
      }
    );
    sendSuccess(res, { connected: ok });
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
