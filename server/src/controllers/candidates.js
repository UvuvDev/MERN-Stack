import mongoose from 'mongoose';
import { Candidate, Office, Vote } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const OFFICE_FIELDS = 'slug name level state district';
const CANDIDATE_LIST_FIELDS =
  'slug name party state district photoUrl isSample office';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function candidateSummary(candidate) {
  if (!candidate) return null;
  const source =
    typeof candidate.toObject === 'function' ? candidate.toObject() : candidate;
  const office =
    source.office && typeof source.office === 'object'
      ? source.office
      : null;

  return {
    id: source._id ?? source.id,
    slug: source.slug,
    name: source.name,
    party: source.party,
    state: source.state ?? null,
    district: source.district ?? null,
    photoUrl: source.photoUrl ?? null,
    isSample: Boolean(source.isSample),
    office: office
      ? {
          id: office._id ?? office.id,
          slug: office.slug,
          name: office.name,
          level: office.level,
          state: office.state ?? null,
          district: office.district ?? null,
        }
      : null,
  };
}

function billSummary(bill) {
  if (!bill) return null;
  return {
    id: bill._id ?? bill.id,
    congress: bill.congress,
    chamber: bill.chamber,
    number: bill.number,
    title: bill.title,
    summary: bill.summary,
    topics: bill.topics ?? [],
    introducedAt: bill.introducedAt ?? null,
    sponsor: bill.sponsor ?? null,
    sourceUrl: bill.sourceUrl ?? null,
    isSample: Boolean(bill.isSample),
  };
}

function voteSummary(vote) {
  return {
    id: vote._id ?? vote.id,
    position: vote.position,
    castAt: vote.castAt ?? null,
    note: vote.note ?? '',
    bill: billSummary(vote.bill),
  };
}

async function loadVotes(candidateId) {
  const votes = await Vote.find({ candidate: candidateId })
    .sort({ castAt: -1 })
    .populate('bill')
    .lean();
  return votes.map(voteSummary);
}

export const listCandidates = asyncHandler(async (req, res) => {
  const { office: officeSlug, search, limit = 50 } = req.query;
  const filter = {};

  if (officeSlug) {
    const office = await Office.findOne({ slug: officeSlug }).lean();
    if (!office) {
      res.json({ candidates: [] });
      return;
    }
    filter.office = office._id;
  }

  if (search) {
    filter.name = { $regex: escapeRegex(search), $options: 'i' };
  }

  const candidates = await Candidate.find(filter)
    .sort({ name: 1 })
    .limit(limit)
    .select(CANDIDATE_LIST_FIELDS)
    .populate('office', OFFICE_FIELDS)
    .lean();

  const ids = candidates.map((candidate) => candidate._id);
  const counts = ids.length
    ? await Vote.aggregate([
        { $match: { candidate: { $in: ids } } },
        { $group: { _id: '$candidate', count: { $sum: 1 } } },
      ])
    : [];

  const countByCandidate = new Map(
    counts.map((row) => [String(row._id), row.count]),
  );

  res.json({
    candidates: candidates.map((candidate) => ({
      ...candidateSummary(candidate),
      voteCount: countByCandidate.get(String(candidate._id)) ?? 0,
    })),
  });
});

async function findCandidateOrThrow(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(404, 'Candidate not found.');
  }

  const candidate = await Candidate.findById(id)
    .populate('office', OFFICE_FIELDS)
    .lean();

  if (!candidate) {
    throw new HttpError(404, 'Candidate not found.');
  }

  return candidate;
}

export const getCandidate = asyncHandler(async (req, res) => {
  const candidate = await findCandidateOrThrow(req.params.id);
  const votes = await loadVotes(candidate._id);

  res.json({
    candidate: {
      ...candidateSummary(candidate),
      officialUrl: candidate.officialUrl ?? null,
      bio: candidate.bio ?? '',
      createdAt: candidate.createdAt ?? null,
      updatedAt: candidate.updatedAt ?? null,
      votes,
    },
  });
});

export const getCandidateVotes = asyncHandler(async (req, res) => {
  const candidate = await findCandidateOrThrow(req.params.id);
  const votes = await loadVotes(candidate._id);
  res.json({ votes });
});

export default {
  listCandidates,
  getCandidate,
  getCandidateVotes,
  candidateSummary,
};
