import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

async function loadConnectDB() {
  const candidates = ['./db/connect.js', './db/index.js', './db/mongoose.js'];
  for (const specifier of candidates) {
    try {
      const mod = await import(specifier);
      const fn = mod.connectDB || mod.connect || mod.default;
      if (typeof fn === 'function') return fn;
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error(
    'Database connector not found. Expected a default export from server/src/db/connect.js.',
  );
}

const app = createApp();
let server = null;
let shuttingDown = false;

async function start() {
  const connectDB = await loadConnectDB();
  await connectDB(env.mongoUri);

  await new Promise((resolve, reject) => {
    server = app.listen(env.port, resolve);
    server.on('error', reject);
  });

  logger.info(
    `Record Over Rhetoric API listening on http://localhost:${env.port} (${env.nodeEnv})`,
  );
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await mongoose.connection.close();
    clearTimeout(forceExit);
    logger.info('Shutdown complete.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
