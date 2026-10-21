import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, query } from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { writeAuditLog } from './audit.service';

const ASSIGNABLE_ROLES = ['ADMIN', 'HR', 'FINANCE'] as const;

export async function listUsers() {
  return query<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.status, r.code AS roleCode, r.name AS roleName
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     ORDER BY u.username`
  );
}

export async function listAssignableRoles() {
  return query<RowDataPacket[]>(
    `SELECT id, code, name FROM roles
     WHERE code IN ('ADMIN', 'HR', 'FINANCE')
     ORDER BY FIELD(code, 'ADMIN', 'HR', 'FINANCE')`
  );
}

export async function createUser(
  input: { username: string; email: string; password: string; roleCode: string },
  actorUserId: string
) {
  const roleId = await roleIdFor(input.roleCode);
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();
  const existing = await query<RowDataPacket[]>(
    `SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1`,
    { username, email }
  );
  if (existing.length) throw new ConflictError('That username or email is already in use');

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(input.password, env.bcryptRounds);
  await execute(
    `INSERT INTO users (id, username, email, password_hash, role_id, status)
     VALUES (:id, :username, :email, :passwordHash, :roleId, 'active')`,
    { id, username, email, passwordHash, roleId }
  );
  await writeAuditLog({
    actorUserId,
    action: 'user.create',
    entityType: 'user',
    entityId: id,
    afterData: { username, email, roleCode: input.roleCode },
  });
  return { id, username, email, roleCode: input.roleCode, status: 'active' };
}

export async function updateUserRole(userId: string, roleCode: string, actorUserId: string) {
  const rows = await query<RowDataPacket[]>(
    `SELECT u.id, u.username, r.code AS roleCode FROM users u
     INNER JOIN roles r ON r.id = u.role_id WHERE u.id = :id LIMIT 1`,
    { id: userId }
  );
  if (!rows.length) throw new NotFoundError('User not found');
  if (String(rows[0].username) === 'superadmin') {
    throw new ValidationError('The super admin role stays in place');
  }
  const roleId = await roleIdFor(roleCode);
  await execute(`UPDATE users SET role_id = :roleId WHERE id = :id`, { id: userId, roleId });
  await writeAuditLog({
    actorUserId,
    action: 'user.role',
    entityType: 'user',
    entityId: userId,
    beforeData: { roleCode: rows[0].roleCode },
    afterData: { roleCode },
  });
}

async function roleIdFor(roleCode: string) {
  if (!ASSIGNABLE_ROLES.includes(roleCode as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new ValidationError('Choose Admin, HR, or Finance');
  }
  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM roles WHERE code = :code LIMIT 1`,
    { code: roleCode }
  );
  if (!rows.length) throw new NotFoundError('Role not found');
  return String(rows[0].id);
}
