import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

import { Candidate, Bill, Vote } from '../models/index.js';
import { castCodeToPosition, downloadCsv } from './realData.js';
import { PRIORITY_MEASURES } from './priority-measures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOTEVIEW_BASE = 'https://voteview.com/static/data/out';
const cacheRoot = process.env.IMPORT_CACHE_DIR
  ? path.resolve(process.env.IMPORT_CACHE_DIR)
  : path.resolve(__dirname, '../../.cache');

function cachePath(file, name) {
  return path.join(cacheRoot, 'voteview', `${file}-${name}.csv`);
}

/**
 * Backfill the explicit priority measures into the normal Bill/Vote tables.
 * This bypasses the "most recent N roll calls" importer window without
 * changing the shared Vote model or its one-vote-per-candidate/bill index.
 */
export async function importPriorityMeasures({
  logger = console,
  refresh = false,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('importPriorityMeasures() requires an open MongoDB connection');
  }

  const results = [];

  for (const definition of PRIORITY_MEASURES) {
    const source = definition.voteview;
    const file = source.file;

    logger?.info?.(`[priority] Loading ${definition.key} from Voteview ${file}...`);
    const [rollCalls, members, voteRows] = await Promise.all([
      downloadCsv(
        `${VOTEVIEW_BASE}/rollcalls/${file}_rollcalls.csv`,
        cachePath(file, 'rollcalls'),
        { refresh, fetchImpl }
      ),
      downloadCsv(
        `${VOTEVIEW_BASE}/members/${file}_members.csv`,
        cachePath(file, 'members'),
        { refresh, fetchImpl }
      ),
      downloadCsv(
        `${VOTEVIEW_BASE}/votes/${file}_votes.csv`,
        cachePath(file, 'votes'),
        { refresh, fetchImpl }
      ),
    ]);

    const rollCall = rollCalls.find(
      (row) =>
        String(row.rollnumber) === String(source.rollNumber) &&
        String(row.chamber || '').toLowerCase() === source.chamber
    );
    if (!rollCall) {
      throw new Error(
        `Priority roll call ${file} ${source.rollNumber} was not found in Voteview data`
      );
    }

    const membersByIcpsr = new Map();
    for (const member of members) {
      if (member.icpsr && member.bioguide_id) {
        membersByIcpsr.set(String(member.icpsr), member);
      }
    }

    const bioguides = new Set();
    for (const row of voteRows) {
      if (String(row.rollnumber) !== String(source.rollNumber)) continue;
      const member = membersByIcpsr.get(String(row.icpsr));
      if (member?.bioguide_id) bioguides.add(String(member.bioguide_id).toUpperCase());
    }

    const candidates = await Candidate.find({
      bioguideId: { $in: [...bioguides] },
    })
      .select('_id bioguideId name')
      .lean();
    const candidatesByBioguide = new Map(
      candidates.map((candidate) => [
        String(candidate.bioguideId).toUpperCase(),
        candidate,
      ])
    );

    const bill = await Bill.findOneAndUpdate(
      {
        congress: definition.bill.congress,
        chamber: definition.bill.chamber,
        number: definition.bill.number,
      },
      { $set: definition.bill },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const castAt = new Date(`${source.date}T00:00:00Z`);
    const note = `${source.question} — ${source.result}`;
    let votes = 0;

    for (const row of voteRows) {
      if (String(row.rollnumber) !== String(source.rollNumber)) continue;
      const position = castCodeToPosition(row.cast_code);
      if (!position) continue;
      const member = membersByIcpsr.get(String(row.icpsr));
      if (!member?.bioguide_id) continue;
      const candidate = candidatesByBioguide.get(
        String(member.bioguide_id).toUpperCase()
      );
      if (!candidate) continue;

      await Vote.findOneAndUpdate(
        { candidate: candidate._id, bill: bill._id },
        {
          $set: {
            candidate: candidate._id,
            bill: bill._id,
            position,
            castAt,
            note,
            question: source.question,
            result: source.result,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
      );
      votes += 1;
    }

    const result = {
      key: definition.key,
      bill: bill.number,
      billId: bill._id,
      candidates: candidates.length,
      votes,
    };
    results.push(result);
    logger?.info?.(
      `[priority] ${definition.key}: ${votes} votes across ${candidates.length} imported candidates`
    );
  }

  return results;
}

export default importPriorityMeasures;
