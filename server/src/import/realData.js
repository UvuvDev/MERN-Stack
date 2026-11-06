import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { Office, Candidate, Bill, Vote, Comparison, Race } from '../models/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_CACHE_DIR = path.resolve(__dirname, '../../.cache');

function resolveCacheRoot(value) {
  const chosen = value || process.env.IMPORT_CACHE_DIR;
  return chosen ? path.resolve(chosen) : LOCAL_CACHE_DIR;
}

const VOTEVIEW_BASE = 'https://voteview.com/static/data/out';
const CONGRESS_BASE = 'https://api.congress.gov/v3';
const CHAMBER_PREFIX = { house: 'H', senate: 'S' };
const USER_AGENT = 'RecordOverRhetoric/1.0 (educational project)';

export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', VI: 'U.S. Virgin Islands', GU: 'Guam', AS: 'American Samoa',
};

const BILL_PREFIXES = {
  HR: { label: 'H.R.', apiType: 'hr', urlType: 'house-bill', chamber: 'house' },
  HRES: { label: 'H.Res.', apiType: 'hres', urlType: 'house-resolution', chamber: 'house' },
  HJRES: { label: 'H.J.Res.', apiType: 'hjres', urlType: 'house-joint-resolution', chamber: 'house' },
  HCONRES: { label: 'H.Con.Res.', apiType: 'hconres', urlType: 'house-concurrent-resolution', chamber: 'house' },
  S: { label: 'S.', apiType: 's', urlType: 'senate-bill', chamber: 'senate' },
  SRES: { label: 'S.Res.', apiType: 'sres', urlType: 'senate-resolution', chamber: 'senate' },
  SJRES: { label: 'S.J.Res.', apiType: 'sjres', urlType: 'senate-joint-resolution', chamber: 'senate' },
  SCONRES: { label: 'S.Con.Res.', apiType: 'sconres', urlType: 'senate-concurrent-resolution', chamber: 'senate' },
};

const TOPIC_KEYWORDS = [
  ['taxes', /\b(tax|taxes|taxation|internal revenue|irs)\b/i],
  ['labor', /\b(labor|worker|workers|wage|wages|employment|union|overtime)\b/i],
  ['healthcare', /\b(health|healthcare|medicare|medicaid|drug|drugs|hospital|insurance coverage)\b/i],
  ['immigration', /\b(immigration|immigrant|alien|border|asylum|visa|deportation)\b/i],
  ['energy', /\b(energy|oil|gas|electric|electricity|climate|pipeline|renewable)\b/i],
  ['education', /\b(education|student|students|school|schools|college|university|loan)\b/i],
  ['defense', /\b(defense|military|armed forces|veteran|veterans|weapon|national security)\b/i],
  ['civil-liberties', /\b(privacy|civil rights|speech|religion|surveillance|due process|liberty)\b/i],
  ['infrastructure', /\b(infrastructure|highway|water resources|transportation|transit|broadband|bridge)\b/i],
  ['housing', /\b(housing|rent|rental|mortgage|homeowner|homeless)\b/i],
  ['budget', /\b(budget|appropriations|spending|deficit|debt limit|continuing resolution)\b/i],
  ['trade', /\b(trade|tariff|tariffs|import|imports|export|exports)\b/i],
  ['agriculture', /\b(agriculture|farm|farms|farmer|crop|livestock)\b/i],
  ['justice', /\b(crime|criminal|justice|police|court|courts|prison|firearm)\b/i],
  ['environment', /\b(environment|conservation|wildlife|pollution|public lands|forest)\b/i],
];

const CAST_CODE_POSITIONS = {
  1: 'yes',
  2: 'yes',
  3: 'yes',
  4: 'no',
  5: 'no',
  6: 'no',
  7: 'abstain',
  8: 'abstain',
  9: 'absent',
};

export function parseCsv(text) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  });
}

export function normalizeBillNumber(raw) {
  if (!raw) return null;
  const cleaned = String(raw).toUpperCase().replace(/[\s.]/g, '');
  const match = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const meta = BILL_PREFIXES[match[1]];
  if (!meta) return null;
  return {
    prefix: match[1],
    digits: match[2],
    number: `${meta.label} ${match[2]}`,
    chamber: meta.chamber,
    apiType: meta.apiType,
    urlType: meta.urlType,
  };
}

export function billSourceUrl(congress, bill) {
  if (!bill) return null;
  return `https://www.congress.gov/bill/${congress}/${bill.urlType}/${bill.digits}`;
}

export function partyFromCode(code) {
  const normalized = String(code ?? '').trim();
  if (normalized === '100') return 'Democratic';
  if (normalized === '200') return 'Republican';
  if (normalized === '328') return 'Independent';
  return 'Other';
}

export function castCodeToPosition(code) {
  return CAST_CODE_POSITIONS[Number(code)] || null;
}

export function formatMemberName(bioname) {
  if (!bioname) return 'Unknown Member';
  const [lastPart = '', restPart = ''] = String(bioname).split(',');
  const first = restPart
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const raw = `${first} ${lastPart}`.replace(/\s+/g, ' ').trim();
  return raw
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (match, separator, letter) => `${separator}${letter.toUpperCase()}`);
}

export function stateName(state) {
  const code = String(state || '').toUpperCase();
  return STATE_NAMES[code] || code;
}

export function officeSlugFor(chamber, state) {
  return `real-${chamber === 'house' ? 'us-house' : 'us-senate'}-${String(state).toLowerCase()}`;
}

export function officeNameFor(chamber, state) {
  return chamber === 'house'
    ? `U.S. House — ${stateName(state)} (all districts)`
    : `U.S. Senate — ${stateName(state)}`;
}

export function inferTopics(...values) {
  const text = values.filter(Boolean).join(' ');
  const topics = [];
  for (const [topic, pattern] of TOPIC_KEYWORDS) {
    if (pattern.test(text)) topics.push(topic);
    if (topics.length >= 3) break;
  }
  return topics.length > 0 ? topics : ['General'];
}

export function stripHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|div|ul|ol)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function questionScore(question) {
  const q = String(question || '').toLowerCase();
  if (/passage|suspend the rules and pass/.test(q)) return 3;
  if (/concur in|agreeing to the .*amendment/.test(q)) return 3;
  if (/agreeing to the resolution/.test(q)) return 2;
  if (/cloture|motion to proceed|previous question|table|recommit|adjourn|quorum/.test(q)) {
    return 1;
  }
  return 2;
}

function dateValue(value) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

function isBetterRollCall(candidate, current) {
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  if (dateValue(candidate.date) !== dateValue(current.date)) {
    return dateValue(candidate.date) > dateValue(current.date);
  }
  return Number(candidate.rollnumber) > Number(current.rollnumber);
}

/**
 * Pick the most substantive recorded vote for each bill in each chamber.
 * This keeps one vote per candidate/bill, which is what the data model stores.
 */
export function selectRollCalls(rows, { limit = 0, chamber: chamberFilter = null } = {}) {
  const groups = new Map();

  for (const row of rows || []) {
    const chamber = String(row.chamber || '').toLowerCase();
    if (!['house', 'senate'].includes(chamber)) continue;
    if (chamberFilter && chamber !== chamberFilter) continue;
    if (!row.bill_number) continue;
    if (Number(row.yea_count || 0) + Number(row.nay_count || 0) === 0) continue;

    const bill = normalizeBillNumber(row.bill_number);
    if (!bill) continue;

    const candidate = {
      ...row,
      chamber,
      bill,
      score: questionScore(row.vote_question),
    };
    const key = `${bill.number}|${chamber}`;

    if (isBetterRollCall(candidate, groups.get(key))) {
      groups.set(key, candidate);
    }
  }

  const selected = [...groups.values()].sort(
    (a, b) => dateValue(b.date) - dateValue(a.date) || Number(b.rollnumber) - Number(a.rollnumber)
  );

  return limit > 0 ? selected.slice(0, limit) : selected;
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(value, max) {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function downloadCsv(url, cacheFile, { refresh, fetchImpl }) {
  if (!refresh && existsSync(cacheFile)) {
    return parseCsv(await fs.readFile(cacheFile, 'utf8'));
  }

  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const text = await response.text();
  await fs.writeFile(cacheFile, text);
  return parseCsv(text);
}

async function fetchCongressJson(url, cacheFile, { refresh, fetchImpl }) {
  if (!refresh && existsSync(cacheFile)) {
    return JSON.parse(await fs.readFile(cacheFile, 'utf8'));
  }
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const error = new Error(`Congress.gov returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  await fs.writeFile(cacheFile, JSON.stringify(data));
  return data;
}

async function enrichFromCongress(billRecords, options) {
  const { congress, apiKey, cacheDir, refresh, fetchImpl, logger } = options;
  const enriched = [];
  let failures = 0;

  for (const record of billRecords) {
    if (!apiKey) break;
    const { bill, meta } = record;
    const base = `${CONGRESS_BASE}/bill/${congress}/${meta.apiType}/${meta.digits}`;
    const detailCache = path.join(cacheDir, 'congress', `${congress}-${meta.apiType}-${meta.digits}.json`);
    const summaryCache = path.join(cacheDir, 'congress', `${congress}-${meta.apiType}-${meta.digits}-summaries.json`);

    try {
      const detail = await fetchCongressJson(
        `${base}?api_key=${encodeURIComponent(apiKey)}&format=json`,
        detailCache,
        { refresh, fetchImpl }
      );
      const source = detail?.bill;
      if (source) {
        if (source.title) bill.title = source.title;
        if (source.policyArea?.name) bill.topics = [source.policyArea.name];
        if (source.introducedDate) bill.introducedAt = new Date(`${source.introducedDate}T00:00:00Z`);
        if (source.sponsors?.[0]?.fullName) bill.sponsor = source.sponsors[0].fullName;
        if (source.url) bill.sourceUrl = source.url;
      }

      const summaries = await fetchCongressJson(
        `${base}/summaries?api_key=${encodeURIComponent(apiKey)}&format=json`,
        summaryCache,
        { refresh, fetchImpl }
      );
      const list = Array.isArray(summaries?.summaries) ? summaries.summaries : [];
      const latest = list[list.length - 1];
      if (latest?.text) {
        bill.summary = truncate(stripHtml(latest.text), 1800);
      }

      enriched.push(record);
      failures = 0;
    } catch (error) {
      failures += 1;
      logger?.warn?.(`[import] Could not enrich ${bill.number}: ${error.message}`);
      if (error.status === 429 || failures >= 3) {
        logger?.warn?.(
          '[import] Stopping Congress.gov enrichment early (rate limit or repeated failures). ' +
            'Re-run with --enrich later to finish the metadata.'
        );
        break;
      }
    }

    await sleep(220);
  }

  return enriched.length;
}

function buildBillPlans(selectedByChamber, congress) {
  const plans = new Map();

  for (const selected of Object.values(selectedByChamber)) {
    for (const rollCall of selected) {
      const key = rollCall.bill.number;
      let plan = plans.get(key);
      if (!plan) {
        plan = {
          bill: {
            congress,
            chamber: rollCall.bill.chamber,
            number: rollCall.bill.number,
            title: '',
            summary: '',
            topics: ['General'],
            introducedAt: null,
            sponsor: null,
            sourceUrl: billSourceUrl(congress, rollCall.bill),
            isSample: false,
          },
          meta: rollCall.bill,
          best: rollCall,
        };
        plans.set(key, plan);
      }
      if (isBetterRollCall(rollCall, plan.best)) {
        plan.best = rollCall;
      }
    }
  }

  for (const plan of plans.values()) {
    const { best, bill } = plan;
    const description = stripHtml(best.vote_desc || best.dtl_desc || '');
    bill.title = description || `${bill.number} — ${stripHtml(best.vote_question) || 'Recorded vote'}`;
    bill.topics = inferTopics(description, best.vote_question);
    const result = stripHtml(best.vote_result);
    const question = stripHtml(best.vote_question);
    bill.summary =
      description && description !== question
        ? `${description} Recorded vote: ${question}${result ? ` (${result})` : ''}.`
        : `${question || 'Recorded vote'}${result ? ` — ${result}` : ''}.`;
    bill.summary = truncate(bill.summary, 1800);
  }

  return [...plans.values()];
}

function groupVotes(voteRows, selected, membersByIcpsr, chamber) {
  const selectedRolls = new Set(selected.map((row) => String(row.rollnumber)));
  const byRoll = new Map();

  for (const row of voteRows) {
    if (chamber && String(row.chamber || '').toLowerCase() !== chamber) continue;
    const roll = String(row.rollnumber);
    if (!selectedRolls.has(roll)) continue;
    const member = membersByIcpsr.get(String(row.icpsr));
    if (!member) continue;
    const position = castCodeToPosition(row.cast_code);
    if (!position) continue;
    if (!byRoll.has(roll)) byRoll.set(roll, []);
    byRoll.get(roll).push({ member, position });
  }

  return byRoll;
}

function normalizeStates(value) {
  if (!value) return null;
  const list = Array.isArray(value) ? value : String(value).split(',');
  const states = list.map((state) => String(state).trim().toUpperCase()).filter(Boolean);
  return states.length > 0 ? states : null;
}

/**
 * Import real congressional voting records.
 *
 * Positions come from Voteview's public roll-call CSVs (both chambers).
 * Bill metadata is optionally enriched from the official Congress.gov API.
 */
export async function importRealData(options = {}) {
  const {
    congress = 119,
    states = ['FL'],
    chambers = ['house', 'senate'],
    limit = 120,
    enrich = false,
    apiKey = process.env.CONGRESS_API_KEY || '',
    reset = false,
    purgeSample = false,
    dryRun = false,
    refreshCache = false,
    cacheDir = null,
    fetchImpl = globalThis.fetch,
    logger = console,
  } = options;

  const chamberList = (Array.isArray(chambers) ? chambers : [chambers])
    .map((chamber) => String(chamber).toLowerCase())
    .filter((chamber) => ['house', 'senate'].includes(chamber));
  if (chamberList.length === 0) {
    throw new Error('At least one chamber (house or senate) is required');
  }

  const cacheRoot = resolveCacheRoot(cacheDir);
  const stateList = normalizeStates(states);
  if (!dryRun && mongoose.connection.readyState !== 1) {
    throw new Error('importRealData() requires an open MongoDB connection');
  }

  const stats = {
    congress,
    states: stateList || 'all',
    chambers: chamberList,
    rollCalls: 0,
    bills: 0,
    offices: 0,
    candidates: 0,
    votes: 0,
    enriched: 0,
    purgedSample: null,
    dryRun,
  };

  const selectedByChamber = {};
  const memberPlans = [];
  const votesByChamber = {};

  for (const chamber of chamberList) {
    const prefix = CHAMBER_PREFIX[chamber];
    const base = `${VOTEVIEW_BASE}`;

    logger?.info?.(`[import] Downloading Voteview ${chamber} roll calls, members, and votes...`);
    const [rollCalls, members, voteRows] = await Promise.all([
      downloadCsv(
        `${base}/rollcalls/${prefix}${congress}_rollcalls.csv`,
        path.join(cacheRoot, 'voteview', `${prefix}${congress}-rollcalls.csv`),
        { refresh: refreshCache, fetchImpl }
      ),
      downloadCsv(
        `${base}/members/${prefix}${congress}_members.csv`,
        path.join(cacheRoot, 'voteview', `${prefix}${congress}-members.csv`),
        { refresh: refreshCache, fetchImpl }
      ),
      downloadCsv(
        `${base}/votes/${prefix}${congress}_votes.csv`,
        path.join(cacheRoot, 'voteview', `${prefix}${congress}-votes.csv`),
        { refresh: refreshCache, fetchImpl }
      ),
    ]);

    const selected = selectRollCalls(rollCalls, { limit, chamber });
    selectedByChamber[chamber] = selected;

    const memberByIcpsr = new Map();
    for (const member of members) {
      if (String(member.chamber || '').toLowerCase() !== chamber) continue;
      if (!member.bioguide_id) continue;
      if (stateList && !stateList.includes(String(member.state_abbrev).toUpperCase())) continue;
      memberByIcpsr.set(String(member.icpsr), member);
    }

    // Only keep people who actually cast a vote in the selected roll calls.
    const votingIcpsrs = new Set();
    const selectedRolls = new Set(selected.map((row) => String(row.rollnumber)));
    for (const row of voteRows) {
      if (!selectedRolls.has(String(row.rollnumber))) continue;
      if (castCodeToPosition(row.cast_code)) votingIcpsrs.add(String(row.icpsr));
    }

    const activeMembers = new Map();
    for (const [icpsr, member] of memberByIcpsr.entries()) {
      if (votingIcpsrs.has(icpsr)) activeMembers.set(icpsr, member);
    }

    votesByChamber[chamber] = groupVotes(voteRows, selected, activeMembers, chamber);

    const seenBioguides = new Set();
    for (const member of activeMembers.values()) {
      const bioguideId = String(member.bioguide_id).toUpperCase();
      if (seenBioguides.has(bioguideId)) continue;
      seenBioguides.add(bioguideId);
      memberPlans.push({ chamber, member });
    }

    stats.rollCalls += selected.length;
    logger?.info?.(
      `[import] ${chamber}: ${selected.length} bills/roll calls, ${activeMembers.size} voting members`
    );
  }

  const billPlans = buildBillPlans(selectedByChamber, congress);

  if (enrich && apiKey) {
    stats.enriched = await enrichFromCongress(billPlans, {
      congress,
      apiKey,
      cacheDir: cacheRoot,
      refresh: refreshCache,
      fetchImpl,
      logger,
    });
  } else if (enrich && !apiKey) {
    logger?.warn?.('[import] --enrich requested but CONGRESS_API_KEY is not set; skipping.');
  }

  stats.bills = billPlans.length;

  if (dryRun) {
    stats.offices = new Set(memberPlans.map(({ chamber, member }) => officeSlugFor(chamber, member.state_abbrev))).size;
    stats.candidates = new Set(memberPlans.map(({ member }) => member.bioguide_id)).size;
    stats.votes = Object.values(votesByChamber).reduce(
      (total, byRoll) => total + [...byRoll.values()].reduce((sum, rows) => sum + rows.length, 0),
      0
    );
    return stats;
  }

  if (purgeSample) {
    logger?.info?.('[import] Removing fictional sample offices, candidates, bills, and votes...');
    const sampleCandidateIds = await Candidate.find({ isSample: true })
      .select('_id')
      .lean();
    const ids = sampleCandidateIds.map((candidate) => candidate._id);
    let comparisons = 0;
    if (ids.length > 0) {
      const removed = await Comparison.deleteMany({
        $or: [{ candidateA: { $in: ids } }, { candidateB: { $in: ids } }],
      });
      comparisons = removed.deletedCount ?? 0;
    }
    const votes = await Vote.deleteMany({ candidate: { $in: ids } });
    const candidates = await Candidate.deleteMany({ isSample: true });
    const bills = await Bill.deleteMany({ isSample: true });
    const races = await Race.deleteMany({ isSample: true });
    const offices = await Office.deleteMany({
      $or: [{ isSample: true }, { isSample: { $exists: false } }],
    });
    stats.purgedSample = {
      comparisons: comparisons,
      votes: votes.deletedCount ?? 0,
      candidates: candidates.deletedCount ?? 0,
      bills: bills.deletedCount ?? 0,
      offices: offices.deletedCount ?? 0,
      races: races.deletedCount ?? 0,
    };
  }

  if (reset) {
    logger?.info?.('[import] Removing previously imported real data...');
    const realCandidates = await Candidate.find({ isSample: false }).select('_id').lean();
    const realCandidateIds = realCandidates.map((candidate) => candidate._id);
    if (realCandidateIds.length > 0) {
      await Comparison.deleteMany({
        $or: [{ candidateA: { $in: realCandidateIds } }, { candidateB: { $in: realCandidateIds } }],
      });
      await Vote.deleteMany({ candidate: { $in: realCandidateIds } });
    }
    await Candidate.deleteMany({ isSample: false });
    await Bill.deleteMany({ isSample: false });
    await Race.deleteMany({ isSample: false });
    await Office.deleteMany({ isSample: false });
  }

  const officeDocs = new Map();
  for (const { chamber, member } of memberPlans) {
    const state = String(member.state_abbrev).toUpperCase();
    const slug = officeSlugFor(chamber, state);
    if (officeDocs.has(slug)) continue;

    const office = await Office.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          name: officeNameFor(chamber, state),
          level: 'federal',
          state,
          district: null,
          description:
            chamber === 'house'
              ? `${stateName(state)} U.S. House delegation. District is shown on each member; use this office to compare any two representatives from the state.`
              : `The two U.S. Senators from ${stateName(state)}.`,
          isSample: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    officeDocs.set(slug, office);
    stats.offices += 1;
  }

  const candidateDocs = new Map();
  for (const { chamber, member } of memberPlans) {
    const bioguideId = String(member.bioguide_id).toUpperCase();
    const state = String(member.state_abbrev).toUpperCase();
    const districtCode = String(member.district_code ?? '').trim();
    const district =
      chamber === 'house' ? (districtCode === '0' ? 'At-Large' : districtCode || null) : null;
    const office = officeDocs.get(officeSlugFor(chamber, state));

    const candidate = await Candidate.findOneAndUpdate(
      { bioguideId },
      {
        $set: {
          bioguideId,
          slug: `real-${bioguideId.toLowerCase()}`,
          name: formatMemberName(member.bioname),
          party: partyFromCode(member.party_code),
          office: office._id,
          state,
          district,
          officialUrl: `https://bioguide.congress.gov/search/bio/${bioguideId}`,
          bio:
            chamber === 'house'
              ? `U.S. Representative for ${stateName(state)}${district ? ` District ${district}` : ''}.`
              : `U.S. Senator from ${stateName(state)}.`,
          isSample: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    candidateDocs.set(bioguideId, candidate);
    stats.candidates += 1;
  }

  const billDocs = new Map();
  for (const plan of billPlans) {
    const bill = await Bill.findOneAndUpdate(
      { congress, chamber: plan.bill.chamber, number: plan.bill.number },
      { $set: plan.bill },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    billDocs.set(plan.bill.number, bill);
  }

  const voteOperations = [];
  for (const [chamber, byRoll] of Object.entries(votesByChamber)) {
    const selected = selectedByChamber[chamber];
    const rollMeta = new Map(selected.map((row) => [String(row.rollnumber), row]));

    for (const [roll, rows] of byRoll.entries()) {
      const meta = rollMeta.get(roll);
      const bill = meta ? billDocs.get(meta.bill.number) : null;
      if (!bill) continue;
      const castAt = meta.date ? new Date(`${meta.date}T00:00:00Z`) : null;
      const note = [stripHtml(meta.vote_question), stripHtml(meta.vote_result)]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 240);

      for (const { member, position } of rows) {
        const candidate = candidateDocs.get(String(member.bioguide_id).toUpperCase());
        if (!candidate) continue;
        voteOperations.push({
          updateOne: {
            filter: { candidate: candidate._id, bill: bill._id },
            update: { $set: { candidate: candidate._id, bill: bill._id, position, castAt, note } },
            upsert: true,
          },
        });
      }
    }
  }

  for (const batch of chunk(voteOperations, 800)) {
    const result = await Vote.bulkWrite(batch, { ordered: false });
    stats.votes += (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
  }

  stats.votes = voteOperations.length;
  return stats;
}

export default importRealData;
