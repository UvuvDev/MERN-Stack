import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const configDir = dirname(fileURLToPath(import.meta.url));
const serverEnvPath = resolve(configDir, '../../.env');
const rootEnvPath = resolve(configDir, '../../../.env');

if (existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
}
if (existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOrigins(value) {
  const origins = String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : ['http://localhost:5173'];
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const mongoUri =
  process.env.MONGODB_URI ||
  (isTest
    ? 'mongodb://127.0.0.1:27017/ror_test'
    : 'mongodb://127.0.0.1:27017/record_over_rhetoric');

const jwtSecret =
  process.env.JWT_SECRET ||
  (isProd ? '' : 'dev-insecure-jwt-secret-change-me');

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
if (isProd && !process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI must be set in production');
}

const env = {
  nodeEnv,
  isProd,
  isTest,
  port: parseNumber(process.env.PORT, 8080),
  mongoUri,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: parseOrigins(process.env.CLIENT_ORIGIN),
  cookieSecure: parseBoolean(process.env.COOKIE_SECURE, isProd),
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl:
      process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    timeoutMs: parseNumber(process.env.AI_TIMEOUT_MS, 75000),
    enabled: parseBoolean(process.env.AI_ENABLED, true),
    fake: parseBoolean(process.env.AI_FAKE, false),
    models: {
      minimax:
        process.env.AI_MODEL_MINIMAX || 'minimax/minimax-m3.1-flash',
      deepseek:
        process.env.AI_MODEL_DEEPSEEK || 'deepseek/deepseek-v4.1-flash',
      grok: process.env.AI_MODEL_GROK || 'x-ai/grok-4.3',
    },
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: parseNumber(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from:
      process.env.MAIL_FROM ||
      'Record Over Rhetoric <no-reply@recordoverrhetoric.app>',
  },
  congressApiKey: process.env.CONGRESS_API_KEY || '',
  seedDemoUser: parseBoolean(process.env.SEED_DEMO_USER, true),
};

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}

deepFreeze(env);

export { env };
export default env;
