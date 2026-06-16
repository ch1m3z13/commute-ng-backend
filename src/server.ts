import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

import { config } from './config/index.js';
import { initializeDatabase } from './config/database.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  usersRouter,
  commutesRouter,
  ridesRouter,
  notificationsRouter,
  chatRouter,
  verificationRouter,
  authRouter,
  passwordResetRouter,
  refreshRouter,
  adminRouter,
} from './routes/index.js';

const app = express();

app.use(helmet());
const allowedOrigins = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);

app.use('/api/password', passwordResetRouter);

app.use('/api/refresh', refreshRouter);

app.use('/api/users', usersRouter);
app.use('/api/commutes', commutesRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

initializeDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
  });
}).catch((error) => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});


export default app;
