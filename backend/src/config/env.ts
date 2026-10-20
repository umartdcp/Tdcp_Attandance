import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 4000),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
  timezone: process.env.TZ ?? 'Asia/Karachi',
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER', 'tdcp_app'),
    password: required('DB_PASSWORD', 'change_me_strong_password'),
    database: required('DB_NAME', 'tdcp_attendance_db'),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 20),
  },
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev_access_secret_change_me_32chars'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me_32chars'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 200),
  },
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  mobileAttendanceEnabled: process.env.MOBILE_ATTENDANCE_ENABLED === 'true',
};
