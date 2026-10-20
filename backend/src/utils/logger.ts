import winston from 'winston';
import { env } from '../config/env';

export const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'tdcp-attendance-api' },
  transports: [
    new winston.transports.Console({
      format: env.isProd
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});
