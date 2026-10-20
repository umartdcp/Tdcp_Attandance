import { randomUUID } from 'crypto';
import { execute } from '../config/database';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  resortId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  await execute(
    `INSERT INTO audit_logs (
      id, actor_user_id, action, entity_type, entity_id, resort_id,
      ip_address, user_agent, before_data, after_data
    ) VALUES (
      :id, :actorUserId, :action, :entityType, :entityId, :resortId,
      :ipAddress, :userAgent, :beforeData, :afterData
    )`,
    {
      id: randomUUID(),
      actorUserId: entry.actorUserId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      resortId: entry.resortId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      beforeData: entry.beforeData ? JSON.stringify(entry.beforeData) : null,
      afterData: entry.afterData ? JSON.stringify(entry.afterData) : null,
    }
  );
}
