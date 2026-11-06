#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { connectDB, disconnectDB } from '../db/connect.js';
import { importPriorityMeasures } from './priority.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  const seen = new Set();
  for (const envPath of envPaths) {
    if (seen.has(envPath)) continue;
    seen.add(envPath);
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
  }
}

async function main() {
  loadEnv();
  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/record_over_rhetoric';
  await connectDB(mongoUri);

  try {
    const results = await importPriorityMeasures();
    process.stdout.write('\nPriority measure import complete\n');
    process.stdout.write('-'.repeat(38) + '\n');
    for (const result of results) {
      process.stdout.write(
        `${result.key}: ${result.votes} votes (${result.bill})\n`
      );
    }
    process.stdout.write('\n');
  } finally {
    await disconnectDB();
  }
}

main().catch(async (error) => {
  process.stderr.write(`\nPriority import failed: ${error.message}\n`);
  process.exitCode = 1;
});
