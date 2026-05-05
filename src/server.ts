import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

import { config } from './config/index.js';
import { featureFlags } from './config/featureFlags.js';
import { initializeFirebase } from './config/firebase.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  usersRouter,
  commutesRouter,
  ridesRouter,
  notificationsRouter,
  chatRouter,
  verificationRouter,
} from './routes/index.js';

if (featureFlags.auth.provider === 'firebase' || featureFlags.database.provider === 'firestore') {
  initializeFirebase();
}

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', usersRouter);
app.use('/api/commutes', commutesRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/verification', verificationRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});

export default app;
