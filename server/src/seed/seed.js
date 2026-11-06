import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { connectDB, disconnectDB } from '../db/connect.js';
import { User, Office, Candidate, Bill, Vote, Comparison, Race } from '../models/index.js';
import { offices, candidates, bills, votes, demoUser } from './data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BCRYPT_ROUNDS = 12;

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

    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
}

export async function resetDatabase() {
  const deleted = {};

  for (const [name, Model] of Object.entries({
    Race,
    Comparison,
    Vote,
    Candidate,
    Bill,
    Office,
    User,
  })) {
    const result = await Model.deleteMany({});
    deleted[name] = result.deletedCount ?? 0;
  }

  return deleted;
}

export async function seedDatabase() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      'seedDatabase() requires an open MongoDB connection; call connectDB(uri) first'
    );
  }

  const officeBySlug = new Map();

  for (const office of offices) {
    const doc = await Office.findOneAndUpdate(
      { slug: office.slug },
      { $set: office },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    officeBySlug.set(office.slug, doc);
  }

  const candidateBySlug = new Map();

  for (const candidate of candidates) {
    const { officeSlug, ...fields } = candidate;
    const officeDoc = officeBySlug.get(officeSlug);

    if (!officeDoc) {
      throw new Error(`Unknown office slug in seed data: ${officeSlug}`);
    }

    const doc = await Candidate.findOneAndUpdate(
      { slug: candidate.slug },
      { $set: { ...fields, office: officeDoc._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    candidateBySlug.set(candidate.slug, doc);
  }

  const billByNumber = new Map();

  for (const bill of bills) {
    const doc = await Bill.findOneAndUpdate(
      { congress: bill.congress, chamber: bill.chamber, number: bill.number },
      { $set: bill },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    billByNumber.set(bill.number, doc);
  }

  for (const vote of votes) {
    const candidateDoc = candidateBySlug.get(vote.candidateSlug);
    const billDoc = billByNumber.get(vote.billNumber);

    if (!candidateDoc) {
      throw new Error(`Unknown candidate slug in seed votes: ${vote.candidateSlug}`);
    }

    if (!billDoc) {
      throw new Error(`Unknown bill number in seed votes: ${vote.billNumber}`);
    }

    const fields = {
      candidate: candidateDoc._id,
      bill: billDoc._id,
      position: vote.position,
      castAt: vote.castAt,
    };

    if (vote.note) {
      fields.note = vote.note;
    }

    await Vote.findOneAndUpdate(
      { candidate: candidateDoc._id, bill: billDoc._id },
      { $set: fields },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }

  let demoUserSeeded = false;

  if (process.env.SEED_DEMO_USER !== 'false') {
    const passwordHash = await bcrypt.hash(demoUser.password, BCRYPT_ROUNDS);

    await User.findOneAndUpdate(
      { email: demoUser.email },
      {
        $set: {
          email: demoUser.email,
          displayName: demoUser.displayName,
          passwordHash,
          isVerified: demoUser.isVerified,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    demoUserSeeded = true;
  }

  const counts = {
    offices: await Office.countDocuments(),
    candidates: await Candidate.countDocuments(),
    bills: await Bill.countDocuments(),
    votes: await Vote.countDocuments(),
    users: await User.countDocuments(),
    comparisons: await Comparison.countDocuments(),
  };

  return {
    counts,
    seeded: {
      offices: offices.length,
      candidates: candidates.length,
      bills: bills.length,
      votes: votes.length,
      demoUser: demoUserSeeded,
    },
  };
}

function printTable(result, resetResult) {
  if (resetResult) {
    const cleared = Object.entries(resetResult)
      .map(([name, count]) => `${name}=${count}`)
      .join(', ');
    console.log(`[seed] Reset cleared documents: ${cleared}`);
  }

  const rows = [
    ['Offices', result.counts.offices, result.seeded.offices],
    ['Candidates', result.counts.candidates, result.seeded.candidates],
    ['Bills', result.counts.bills, result.seeded.bills],
    ['Votes', result.counts.votes, result.seeded.votes],
    ['Users', result.counts.users, result.seeded.demoUser ? 1 : 0],
    ['Comparisons', result.counts.comparisons, 0],
  ];

  const headers = ['Collection', 'In database', 'Seed input'];
  const widths = [
    Math.max(headers[0].length, ...rows.map((row) => String(row[0]).length)),
    Math.max(headers[1].length, ...rows.map((row) => String(row[1]).length)),
    Math.max(headers[2].length, ...rows.map((row) => String(row[2]).length)),
  ];

  const line = (cells) =>
    cells.map((cell, index) => String(cell).padEnd(widths[index])).join('  ');

  console.log('');
  console.log(line(headers));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));

  for (const row of rows) {
    console.log(line(row));
  }

  console.log('');
  console.log(
    `[seed] Demo account (${demoUser.email}): ${
      result.seeded.demoUser ? 'seeded/updated' : 'skipped (SEED_DEMO_USER=false)'
    }`
  );
  console.log('[seed] Sample data is fictional and marked isSample=true.');
}

async function runCli() {
  loadEnv();

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error(
      '[seed] MONGODB_URI is not set. Add it to server/.env or export it in your shell.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB(uri);

    let resetResult = null;

    if (process.argv.includes('--reset')) {
      resetResult = await resetDatabase();
    }

    const result = await seedDatabase();
    printTable(result, resetResult);
    process.exitCode = 0;
  } catch (error) {
    console.error(`[seed] Seed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    try {
      await disconnectDB();
    } catch (error) {
      console.error(`[seed] Disconnect failed: ${error.message}`);
    }
  }
}

const isEntryPoint =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  runCli().catch((error) => {
    console.error(`[seed] Unexpected failure: ${error.message}`);
    process.exitCode = 1;
  });
}
