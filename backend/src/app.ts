import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';
import iclockRouter from './iclock/router';
import { startSyncScheduler } from './jobs/sync-scheduler';

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use('/iclock', iclockRouter);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan(env.isProd ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);
app.use(
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/', (_req, res) => {
  res.json({
    name: 'TDCP Universal Attendance Management System API',
    version: '1.0.0',
    docs: `${env.apiPrefix}/health`,
  });
});

app.use(env.apiPrefix, routes);
app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.port, () => {
    logger.info(`TDCP API listening on port ${env.port} (${env.nodeEnv})`);
    logger.info(`API prefix: ${env.apiPrefix}`);
  });
  startSyncScheduler();
}

export default app;
