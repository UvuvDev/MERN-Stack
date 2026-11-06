import mongoose from 'mongoose';
import { Comparison, Office, Race } from '../models/index.js';
import { getComparisonData } from '../services/comparisonData.js';
import { compareVotingRecords } from '../services/ai/compare.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function getId(value) {
  if (!value) return undefined;
  return value._id ?? value.id;
}

function ownerId(req) {
  return getId(req.user);
}

function officeSummary(office) {
  if (!office) return null;
  const source = typeof office.toObject === 'function' ? office.toObject() : office;
  return {
    id: source._id ?? source.id,
    slug: source.slug,
    name: source.name,
    level: source.level,
    state: source.state ?? null,
    district: source.district ?? null,
  };
}

function comparisonCandidateSummary(candidate, fallbackOffice) {
  if (!candidate) return null;
  const source =
    typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
  const rawOffice =
    source.office && typeof source.office === 'object'
      ? source.office
      : fallbackOffice;
  const office =
    rawOffice && typeof rawOffice === 'object' ? officeSummary(rawOffice) : null;

  return {
    id: source._id ?? source.id,
    slug: source.slug,
    name: source.name,
    party: source.party,
    photoUrl: source.photoUrl ?? null,
    office,
  };
}

async function resolveOffice(candidate) {
  const raw = candidate?.office;
  if (raw && typeof raw === 'object' && (raw.name || raw.slug)) {
    return raw;
  }
  const id = raw?._id ?? raw;
  if (!id) return null;
  return Office.findById(id).lean();
}

function compactModel(model) {
  return {
    key: model?.key,
    ok: Boolean(model?.ok),
    latencyMs: model?.latencyMs ?? 0,
  };
}

function fullModel(model) {
  return {
    key: model?.key,
    modelId: model?.modelId ?? null,
    ok: Boolean(model?.ok),
    latencyMs: model?.latencyMs ?? 0,
    analysis: model?.analysis ?? null,
    error: model?.error ?? null,
  };
}

function serializeComparison(doc, { compact = false } = {}) {
  const source = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const office = officeSummary(source.office);
  const comparison = {
    id: source._id ?? source.id,
    createdAt: source.createdAt ?? null,
    updatedAt: source.updatedAt ?? null,
    candidateA: comparisonCandidateSummary(source.candidateA, source.office),
    candidateB: comparisonCandidateSummary(source.candidateB, source.office),
    office,
    votesSnapshot: source.votesSnapshot ?? { candidateA: 0, candidateB: 0 },
    models: (source.models ?? []).map(compact ? compactModel : fullModel),
    race: source.race && typeof source.race === 'object'
      ? {
          id: source.race._id ?? source.race.id,
          slug: source.race.slug ?? null,
          name: source.race.name ?? null,
          electionYear: source.race.electionYear ?? null,
        }
      : null,
  };
  if (!compact) {
    comparison.billReferences = Array.isArray(source.billReferences)
      ? source.billReferences
      : [];
  }
  return comparison;
}

export const createComparison = asyncHandler(async (req, res) => {
  const { candidateAId, candidateBId, raceId } = req.body;

  let race = null;
  if (raceId) {
    const identifier = String(raceId).trim();
    const query = mongoose.isValidObjectId(identifier)
      ? { $or: [{ _id: identifier }, { slug: identifier.toLowerCase() }] }
      : { slug: identifier.toLowerCase() };
    race = await Race.findOne(query).lean();
    if (!race) {
      throw new HttpError(404, 'Race not found.');
    }
    const raceCandidateIds = (race.candidates ?? []).map((id) => String(id));
    if (
      !raceCandidateIds.includes(String(candidateAId)) ||
      !raceCandidateIds.includes(String(candidateBId))
    ) {
      throw new HttpError(400, 'Both candidates must belong to the selected race.');
    }
  }

  const data = await getComparisonData(candidateAId, candidateBId, {
    allowDifferentOffices: Boolean(race),
  });

  const result = await compareVotingRecords({
    candidateA: data.candidateA,
    candidateB: data.candidateB,
    recordsA: data.recordsA,
    recordsB: data.recordsB,
  });

  const office = race
    ? await Office.findById(race.office).lean()
    : await resolveOffice(data.candidateA);
  const officeId = race
    ? race.office
    : office?._id ??
      office?.id ??
      data.candidateA?.office?._id ??
      data.candidateA?.office?.id ??
      data.candidateA?.office;

  const created = await Comparison.create({
    user: ownerId(req),
    candidateA: getId(data.candidateA),
    candidateB: getId(data.candidateB),
    office: officeId,
    race: race ? race._id : null,
    votesSnapshot: {
      candidateA: Array.isArray(data.recordsA) ? data.recordsA.length : 0,
      candidateB: Array.isArray(data.recordsB) ? data.recordsB.length : 0,
    },
    models: result.models,
    billReferences: result.billReferences ?? [],
  });

  const comparison = serializeComparison(created);
  comparison.candidateA = comparisonCandidateSummary(
    data.candidateA,
    office,
  );
  comparison.candidateB = comparisonCandidateSummary(
    data.candidateB,
    office,
  );
  comparison.office = officeSummary(office);
  if (race) {
    comparison.race = {
      id: race._id,
      slug: race.slug,
      name: race.name,
      electionYear: race.electionYear,
    };
  }

  res.status(201).json({ comparison });
});

export const listComparisons = asyncHandler(async (req, res) => {
  const page = req.query.page ?? 1;
  const limit = req.query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter = { user: ownerId(req) };

  const [docs, total] = await Promise.all([
    Comparison.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('candidateA', 'slug name party photoUrl office')
      .populate('candidateB', 'slug name party photoUrl office')
      .populate('office', 'slug name level state district')
      .populate('race', 'slug name electionYear')
      .lean(),
    Comparison.countDocuments(filter),
  ]);

  res.json({
    comparisons: docs.map((doc) => serializeComparison(doc, { compact: true })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getComparison = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new HttpError(404, 'Comparison not found.');
  }

  const doc = await Comparison.findOne({
    _id: req.params.id,
    user: ownerId(req),
  })
    .populate('candidateA', 'slug name party photoUrl office')
    .populate('candidateB', 'slug name party photoUrl office')
    .populate('office', 'slug name level state district')
    .populate('race', 'slug name electionYear')
    .lean();

  if (!doc) {
    throw new HttpError(404, 'Comparison not found.');
  }

  res.json({ comparison: serializeComparison(doc) });
});

export default {
  createComparison,
  listComparisons,
  getComparison,
};
