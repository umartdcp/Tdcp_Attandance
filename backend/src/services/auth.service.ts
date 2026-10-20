import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { query, execute } from '../config/database';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { writeAuditLog } from './audit.service';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  employeeId: string | null;
  permissions: string[];
  locationIds: string[];
}

interface TokenPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
}

function signAccessToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, role: user.roleCode, type: 'access' } satisfies TokenPayload,
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

function signRefreshToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, role: user.roleCode, type: 'refresh' } satisfies TokenPayload,
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const users = await query<RowDataPacket[]>(
    `SELECT u.id, u.username, u.email, u.role_id AS roleId, u.employee_id AS employeeId,
            u.status, r.code AS roleCode, r.name AS roleName
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.id = :userId
     LIMIT 1`,
    { userId }
  );
  if (!users.length || users[0].status !== 'active') return null;

  const perms = await query<RowDataPacket[]>(
    `SELECT p.code
     FROM role_permissions rp
     INNER JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = :roleId`,
    { roleId: users[0].roleId }
  );

  const locations = await query<RowDataPacket[]>(
    `SELECT resort_id AS resortId FROM user_location_access WHERE user_id = :userId`,
    { userId }
  );

  return {
    id: users[0].id,
    username: users[0].username,
    email: users[0].email,
    roleId: users[0].roleId,
    roleCode: users[0].roleCode,
    roleName: users[0].roleName,
    employeeId: users[0].employeeId,
    permissions: perms.map((p) => p.code as string),
    locationIds: locations.map((l) => l.resortId as string),
  };
}

export async function login(
  username: string,
  password: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  const rows = await query<RowDataPacket[]>(
    `SELECT id, password_hash AS passwordHash, status
     FROM users
     WHERE username = :username OR email = :username
     LIMIT 1`,
    { username }
  );

  if (!rows.length) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const row = rows[0];
  if (row.status !== 'active') {
    throw new ForbiddenError('Account is not active');
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid username or password');
  }

  const user = await loadAuthUser(row.id);
  if (!user) {
    throw new UnauthorizedError('Unable to load user profile');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshHash = await bcrypt.hash(refreshToken, 10);

  await execute(
    `UPDATE users SET last_login_at = NOW(), refresh_token_hash = :hash WHERE id = :id`,
    { hash: refreshHash, id: user.id }
  );

  await writeAuditLog({
    actorUserId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    ipAddress: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return { accessToken, refreshToken, user };
}

export async function refreshSession(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret) as TokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type');
  }

  const rows = await query<RowDataPacket[]>(
    `SELECT id, refresh_token_hash AS refreshHash, status FROM users WHERE id = :id LIMIT 1`,
    { id: payload.sub }
  );
  if (!rows.length || rows[0].status !== 'active' || !rows[0].refreshHash) {
    throw new UnauthorizedError('Session expired');
  }

  const match = await bcrypt.compare(refreshToken, rows[0].refreshHash);
  if (!match) {
    throw new UnauthorizedError('Refresh token revoked');
  }

  const user = await loadAuthUser(rows[0].id);
  if (!user) throw new UnauthorizedError('User not found');

  const accessToken = signAccessToken(user);
  const newRefresh = signRefreshToken(user);
  const refreshHash = await bcrypt.hash(newRefresh, 10);
  await execute(`UPDATE users SET refresh_token_hash = :hash WHERE id = :id`, {
    hash: refreshHash,
    id: user.id,
  });

  return { accessToken, refreshToken: newRefresh, user };
}

export async function logout(userId: string): Promise<void> {
  await execute(`UPDATE users SET refresh_token_hash = NULL WHERE id = :id`, { id: userId });
  await writeAuditLog({
    actorUserId: userId,
    action: 'auth.logout',
    entityType: 'user',
    entityId: userId,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as TokenPayload;
    if (payload.type !== 'access') {
      throw new UnauthorizedError('Invalid token type');
    }
    return payload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
