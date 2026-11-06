import mongoose from 'mongoose';
import { Race, Vote } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

function toPlain(document) {
  if (!document) return null;
  return typeof document.toObject === 'function' ? document.toObject() : document;
}

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function officeSummary(office) {
  const source = toPlain(office);
  if (!source) return null;
  return {
    id: source._id ? String(source._id) : null,
    slug: source.slug ?? null,
    name: source.name ?? null,
    level: source.level ?? null,
    state: source.state ?? null,
    district: source.district ?? null,
  };
}

function candidateSummary(candidate, voteCounts) {
  const source = toPlain(candidate);
  if (!source) return null;
  const id = source._id ? String(source._id) : null;
  return {
    id,
    slug: source.slug ?? null,
    name: source.name ?? null,
    party: source.party ?? null,
    photoUrl: source.photoUrl ?? null,
    office: source.office && typeof source.office === 'object'
      ? officeSummary(source.office)
      : idOf(source.office),
    state: source.state ?? null,
    district: source.district ?? null,
    isSample: Boolean(source.isSample),
    voteCount: id ? voteCounts.get(id) || 0 : 0,
  };
}

function serializeRace(race, voteCounts = new Map()) {
  const source = toPlain(race);
  if (!source) return null;
  return {
    id: source._id ? String(source._id) : null,
    slug: source.slug ?? null,
    name: source.name ?? null,
    electionYear: source.electionYear ?? null,
    electionDate: source.electionDate ?? null,
    office: officeSummary(source.office),
    state: source.state ?? null,
    district: source.district ?? null,
    description: source.description ?? '',
    sourceUrl: source.sourceUrl ?? null,
    isSample: Boolean(source.isSample),
    candidates: (source.candidates ?? [])
      .map((candidate) => candidateSummary(candidate, voteCounts))
      .filter(Boolean),
    missingNominees: (source.missingNominees ?? []).map((nominee) => ({
      name: nominee.name ?? null,
      party: nominee.party ?? null,
      reason: nominee.reason ?? 'No federal roll-call record in the imported dataset.',
    })),
    comparable:
      (source.candidates ?? []).filter(Boolean).length >= 2 &&
      (source.candidates ?? [])
        .filter(Boolean)
        .every((candidate) => (voteCounts.get(String(candidate._id ?? candidate.id)) || 0) > 0),
  };
}

async function voteCountsFor(races) {
  const ids = new Set();
  for (const race of races) {
    for (const candidate of race.candidates ?? []) {
      const id = idOf(candidate);
      if (id) ids.add(id);
    }
  }

  const counts = new Map();
  if (ids.size === 0) return counts;

  const rows = await Vote.aggregate([
    { $match: { candidate: { $in: [...ids].map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: '$candidate', count: { $sum: 1 } } },
  ]);

  for (const row of rows) {
    counts.set(String(row._id), row.count);
  }
  return counts;
}

export const listRaces = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.year !== undefined) {
    const year = Number(req.query.year);
    if (Number.isFinite(year)) filter.electionYear = year;
  }
  if (req.query.state) {
    filter.state = String(req.query.state).toUpperCase();
  }

  const races = await Race.find(filter)
    .sort({ electionYear: -1, name: 1 })
    .populate('office', 'slug name level state district')
    .populate('candidates', 'slug name party office photoUrl state district isSample')
    .lean();

  const counts = await voteCountsFor(races);
  res.json({ races: races.map((race) => serializeRace(race, counts)) });
});

export const getRace = asyncHandler(async (req, res) => {
  const identifier = String(req.params.idOrSlug || '').trim();
  if (!identifier) {
    throw new HttpError(404, 'Race not found.');
  }

  const query = mongoose.isValidObjectId(identifier)
    ? { $or: [{ _id: identifier }, { slug: identifier.toLowerCase() }] }
    : { slug: identifier.toLowerCase() };

  const race = await Race.findOne(query)
    .populate('office', 'slug name level state district')
    .populate('candidates', 'slug name party office photoUrl state district isSample')
    .lean();

  if (!race) {
    throw new HttpError(404, 'Race not found.');
  }

  const counts = await voteCountsFor([race]);
  res.json({ race: serializeRace(race, counts) });
});

export default { listRaces, getRace };
