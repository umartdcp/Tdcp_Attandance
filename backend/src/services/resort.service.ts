import { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../config/database';
import { createResortWithTables, CreateResortInput } from '../database/resort-provisioning/provisioner';
import { NotFoundError } from '../utils/errors';
import { writeAuditLog } from './audit.service';

const DEFAULT_ORG = '11111111-1111-1111-1111-111111111111';

export async function listResorts(filters?: {
  status?: string;
  regionId?: string;
  locationIds?: string[] | null;
}) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters?.status) {
    clauses.push('r.status = :status');
    params.status = filters.status;
  }
  if (filters?.regionId) {
    clauses.push('r.region_id = :regionId');
    params.regionId = filters.regionId;
  }
  if (filters?.locationIds && filters.locationIds.length > 0) {
    clauses.push(`r.id IN (${filters.locationIds.map((_, i) => `:loc${i}`).join(',')})`);
    filters.locationIds.forEach((id, i) => {
      params[`loc${i}`] = id;
    });
  } else if (filters?.locationIds && filters.locationIds.length === 0) {
    return [];
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return query<RowDataPacket[]>(
    `SELECT r.id, r.code, r.name, r.location_type AS locationType, r.table_prefix AS tablePrefix,
            r.region_id AS regionId, reg.name AS regionName, r.address, r.contact_phone AS contactPhone,
            r.contact_email AS contactEmail, r.status, r.created_at AS createdAt,
            (SELECT COUNT(*) FROM employees e WHERE e.current_resort_id = r.id AND e.status = 'active') AS employeeCount
     FROM resorts r
     LEFT JOIN regions reg ON reg.id = r.region_id
     ${where}
     ORDER BY r.location_type, r.name`,
    params
  );
}

export async function getResortById(id: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT r.*, reg.name AS regionName, rtr.tables_json AS tablesJson
     FROM resorts r
     LEFT JOIN regions reg ON reg.id = r.region_id
     LEFT JOIN resort_table_registry rtr ON rtr.resort_id = r.id
     WHERE r.id = :id LIMIT 1`,
    { id }
  );
  if (!rows.length) throw new NotFoundError('Resort not found');
  return rows[0];
}

export async function createResort(input: CreateResortInput, actorUserId: string) {
  const result = await createResortWithTables({
    ...input,
    organizationId: input.organizationId || DEFAULT_ORG,
  });
  await writeAuditLog({
    actorUserId,
    action: 'resort.create',
    entityType: 'resort',
    entityId: result.id,
    resortId: result.id,
    afterData: result,
  });
  return result;
}

export async function updateResort(
  id: string,
  data: {
    name?: string;
    regionId?: string | null;
    address?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    status?: 'active' | 'inactive';
    attendanceConfig?: Record<string, unknown> | null;
  },
  actorUserId: string
) {
  const existing = await getResortById(id);
  await execute(
    `UPDATE resorts SET
      name = IF(:setName = 1, :name, name),
      region_id = IF(:setRegion = 1, :regionId, region_id),
      address = IF(:setAddress = 1, :address, address),
      contact_phone = IF(:setPhone = 1, :contactPhone, contact_phone),
      contact_email = IF(:setEmail = 1, :contactEmail, contact_email),
      status = IF(:setStatus = 1, :status, status),
      attendance_config = IF(:setConfig = 1, :attendanceConfig, attendance_config)
     WHERE id = :id`,
    {
      id,
      setName: data.name !== undefined ? 1 : 0,
      name: data.name ?? null,
      setRegion: data.regionId !== undefined ? 1 : 0,
      regionId: data.regionId ?? null,
      setAddress: data.address !== undefined ? 1 : 0,
      address: data.address ?? null,
      setPhone: data.contactPhone !== undefined ? 1 : 0,
      contactPhone: data.contactPhone ?? null,
      setEmail: data.contactEmail !== undefined ? 1 : 0,
      contactEmail: data.contactEmail ?? null,
      setStatus: data.status !== undefined ? 1 : 0,
      status: data.status ?? null,
      setConfig: data.attendanceConfig !== undefined ? 1 : 0,
      attendanceConfig: data.attendanceConfig ? JSON.stringify(data.attendanceConfig) : null,
    }
  );
  const updated = await getResortById(id);
  await writeAuditLog({
    actorUserId,
    action: 'resort.update',
    entityType: 'resort',
    entityId: id,
    resortId: id,
    beforeData: existing,
    afterData: updated,
  });
  return updated;
}

export async function listRegions() {
  return query<RowDataPacket[]>(
    `SELECT id, code, name, status FROM regions WHERE status = 'active' ORDER BY name`
  );
}
