#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../db/connect.js';
import { Candidate } from '../models/index.js';
import { importRealData } from './realData.js';

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

function parseArgs(argv) {
  const options = {
    congress: 119,
    states: ['FL'],
    chambers: ['house', 'senate'],
    limit: 120,
    enrich: false,
    reset: false,
    purgeSample: false,
    dryRun: false,
    refreshCache: false,
  };

  for (const argument of argv) {
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--all-states') {
      options.states = null;
      continue;
    }
    if (argument === '--enrich') {
      options.enrich = true;
      continue;
    }
    if (argument === '--reset') {
      options.reset = true;
      continue;
    }
    if (argument === '--purge-sample') {
      options.purgeSample = true;
      continue;
    }
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--refresh-cache') {
      options.refreshCache = true;
      continue;
    }
    const match = argument.match(/^--([a-z-]+)=(.*)$/i);
    if (!match) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    const [, key, value] = match;
    if (key === 'congress') options.congress = Number(value);
    else if (key === 'state' || key === 'states') {
      options.states = value.split(',').map((state) => state.trim()).filter(Boolean);
    } else if (key === 'chamber') {
      options.chambers =
        value === 'both' ? ['house', 'senate'] : [value.trim().toLowerCase()];
    } else if (key === 'limit') options.limit = Number(value);
    else throw new Error(`Unknown option: --${key}`);
  }

  return options;
}

const HELP = `Import real congressional voting records.

Usage:
  npm run import:real -- --state=FL [options]

Options:
  --state=FL,GA       State(s) to import (default: FL)
  --all-states        Import every state (slower, many offices)
  --chamber=both      both | house | senate (default: both)
  --congress=119      Congress number (default: 119)
  --limit=120         Most recent bills/roll calls per chamber (0 = all)
  --enrich            Fetch official bill titles/summaries/policy areas from
                      Congress.gov (requires CONGRESS_API_KEY)
  --reset             Delete previously imported real (non-sample) records first
  --purge-sample      Delete the fictional sample offices, candidates, bills, and votes
  --refresh-cache     Re-download Voteview CSVs and Congress.gov responses
  --dry-run           Parse sources and print counts without writing to MongoDB

Data sources:
  - Voteview (UCLA) public roll-call CSVs: per-member positions, both chambers.
  - Congress.gov API (optional key): official bill titles, summaries, topics.

Notes:
  - Real records are stored alongside the fictional sample seed data.
  - Candidate, bill, and office records created here are marked isSample=false.
  - To start over with only real data: npm run seed -- --reset, then import.
  - A Congress.gov API key is free at https://api.congress.gov/sign-up/.
`;

async function main() {
  loadEnv();
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    process.stdout.write(HELP);
    return;
  }

  if (!Number.isFinite(options.congress) || options.congress < 1) {
    throw new Error('--congress must be a positive number');
  }
  if (!Number.isFinite(options.limit) || options.limit < 0) {
    throw new Error('--limit must be zero or a positive number');
  }

  const mongoUri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/record_over_rhetoric';
  const apiKey = process.env.CONGRESS_API_KEY || '';

  if (!options.dryRun) {
    await connectDB(mongoUri);
  }

  try {
    const stats = await importRealData({
      congress: options.congress,
      states: options.states,
      chambers: options.chambers,
      limit: options.limit,
      enrich: options.enrich,
      apiKey,
      reset: options.reset,
      purgeSample: options.purgeSample,
      dryRun: options.dryRun,
      refreshCache: options.refreshCache,
    });

    const mode = stats.dryRun ? 'DRY RUN — nothing written' : 'Import complete';
    process.stdout.write(`\n${mode}\n`);
    process.stdout.write('-'.repeat(mode.length) + '\n');
    process.stdout.write(`Congress:    ${stats.congress}\n`);
    process.stdout.write(`States:      ${Array.isArray(stats.states) ? stats.states.join(', ') : 'all'}\n`);
    process.stdout.write(`Chambers:    ${stats.chambers.join(', ')}\n`);
    process.stdout.write(`Roll calls:  ${stats.rollCalls}\n`);
    process.stdout.write(`Bills:       ${stats.bills}\n`);
    process.stdout.write(`Offices:     ${stats.offices}\n`);
    process.stdout.write(`Candidates:  ${stats.candidates}\n`);
    process.stdout.write(`Votes:       ${stats.votes}\n`);
    process.stdout.write(`Enriched:    ${stats.enriched} bill(s) from Congress.gov\n`);
    if (stats.purgedSample) {
      process.stdout.write(
        `Purged sample: ${stats.purgedSample.candidates} candidates, ${stats.purgedSample.bills} bills, ${stats.purgedSample.votes} votes, ${stats.purgedSample.offices} offices\n`
      );
    }
    process.stdout.write('\n');
    process.stdout.write(
      'Start the app and choose an office whose candidates have real records.\n'
    );
    const sampleCount = await Candidate.countDocuments({ isSample: true });
    if (stats.purgedSample || sampleCount === 0) {
      process.stdout.write('Only real records are in this database.\n');
    } else {
      process.stdout.write(
        'Fictional seed candidates remain available and are labeled as sample data.\n'
      );
    }
  } finally {
    if (!options.dryRun) {
      await disconnectDB();
    }
  }
}

main().catch(async (error) => {
  process.stderr.write(`\nImport failed: ${error.message}\n`);
  if (mongoose.connection.readyState === 1) {
    await disconnectDB().catch(() => {});
  }
  process.exitCode = 1;
});
