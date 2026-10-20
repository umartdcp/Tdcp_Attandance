import { Router } from 'express';
import { pingDatabase } from '../config/database';
import { sendSuccess } from '../utils/response';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const dbOk = await pingDatabase();
    sendSuccess(res, {
      status: dbOk ? 'ok' : 'degraded',
      service: 'tdcp-attendance-api',
      database: dbOk ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Karachi',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
