import express from 'express';
import { errorHandler, notFoundHandler } from '../../middleware/errorHandler.js';
import {
  usersRouter,
  commutesRouter,
  ridesRouter,
  notificationsRouter,
  chatRouter,
  verificationRouter,
  authRouter,
} from '../../routes/index.js';

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/commutes', commutesRouter);
  app.use('/api/rides', ridesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/verification', verificationRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
