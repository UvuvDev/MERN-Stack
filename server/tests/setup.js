import { afterAll, afterEach, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { rateLimitStores } from '../src/middleware/rateLimit.js';

let mongoServer;

async function clearCollections() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(
    collections.map((collection) => collection.deleteMany({})),
  );
}

async function resetRateLimits() {
  if (rateLimitStores?.auth) await rateLimitStores.auth.resetAll();
  if (rateLimitStores?.compare) await rateLimitStores.compare.resetAll();
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { dbName: 'ror_test' },
  });
  const uri = mongoServer.getUri('ror_test');
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
}, 120000);

afterEach(async () => {
  await clearCollections();
  await resetRateLimits();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 120000);
