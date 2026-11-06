import { HttpError } from '../utils/httpError.js';
import { getModel } from '../utils/models.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const MAX_RECORDS_PER_CANDIDATE = 60;

function toPlain(document) {
  if (!document) return null;
  if (typeof document.toObject === 'function') return document.toObject();
  return document;
}

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function shapeOffice(office) {
  const raw = toPlain(office);
  return {
    id: raw?._id ? String(raw._id) : null,
    slug: raw?.slug ?? null,
    name: raw?.name ?? null,
    level: raw?.level ?? null,
    state: raw?.state ?? null,
    district: raw?.district ?? null,
  };
}

export function shapeCandidateSummary(candidate) {
  const raw = toPlain(candidate);
  if (!raw) return null;

  const hasPopulatedOffice =
    raw.office && typeof raw.office === 'object' && !Array.isArray(raw.office);

  return {
    id: raw._id ? String(raw._id) : raw.id ? String(raw.id) : null,
    slug: raw.slug ?? null,
    name: raw.name ?? null,
    party: raw.party ?? null,
    office: hasPopulatedOffice
      ? shapeOffice(raw.office)
      : raw.office
        ? String(raw.office)
        : null,
    state: raw.state ?? null,
    district: raw.district ?? null,
    photoUrl: raw.photoUrl ?? null,
    officialUrl: raw.officialUrl ?? null,
    bio: raw.bio ?? null,
    isSample: Boolean(raw.isSample),
  };
}

function shapeBill(bill) {
  const raw = toPlain(bill);
  if (!raw) return null;
  return {
    id: raw._id ? String(raw._id) : raw.id ? String(raw.id) : null,
    number: raw.number ?? null,
    title: raw.title ?? null,
    summary: raw.summary ?? null,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    chamber: raw.chamber ?? null,
    congress: raw.congress ?? null,
    introducedAt: raw.introducedAt ?? null,
    sponsor: raw.sponsor ?? null,
    sourceUrl: raw.sourceUrl ?? null,
  };
}

function shapeVote(vote) {
  const raw = toPlain(vote);
  const bill = shapeBill(raw?.bill);
  if (!bill) return null;
  return {
    id: raw._id ? String(raw._id) : raw.id ? String(raw.id) : null,
    position: raw.position ?? null,
    castAt: raw.castAt ?? null,
    note: raw.note ?? null,
    bill,
  };
}

function normalizeId(value, label) {
  const id = value == null ? '' : String(value).trim();
  if (!OBJECT_ID_PATTERN.test(id)) {
    throw new HttpError(400, `${label} must be a valid candidate id`, {
      field: label,
    });
  }
  return id;
}

export async function getComparisonData(candidateAId, candidateBId, { allowDifferentOffices = false } = {}) {
  const idA = normalizeId(candidateAId, 'candidateAId');
  const idB = normalizeId(candidateBId, 'candidateBId');

  if (idA.toLowerCase() === idB.toLowerCase()) {
    throw new HttpError(400, 'Choose two different candidates');
  }

  const Candidate = getModel('Candidate');
  const Vote = getModel('Vote');

  const [candidateA, candidateB] = await Promise.all([
    Candidate.findById(idA).populate('office').lean(),
    Candidate.findById(idB).populate('office').lean(),
  ]);

  if (!candidateA || !candidateB) {
    throw new HttpError(404, 'Candidate not found');
  }

  const officeA = idOf(candidateA.office);
  const officeB = idOf(candidateB.office);
  if (!officeA || !officeB) {
    throw new HttpError(400, 'Both candidates must belong to an office');
  }
  if (!allowDifferentOffices && officeA !== officeB) {
    throw new HttpError(400, 'Candidates must belong to the same office');
  }

  const votes = await Vote.find({ candidate: { $in: [idA, idB] } })
    .sort({ castAt: -1, _id: -1 })
    .populate('bill')
    .lean();

  const recordsA = [];
  const recordsB = [];
  for (const vote of votes) {
    const shaped = shapeVote(vote);
    if (!shaped) continue;
    if (idOf(vote.candidate) === idA) {
      recordsA.push(shaped);
    } else if (idOf(vote.candidate) === idB) {
      recordsB.push(shaped);
    }
  }

  return {
    candidateA: shapeCandidateSummary(candidateA),
    candidateB: shapeCandidateSummary(candidateB),
    // Votes are newest-first; cap the prompt size while treating both sides equally.
    recordsA: recordsA.slice(0, MAX_RECORDS_PER_CANDIDATE),
    recordsB: recordsB.slice(0, MAX_RECORDS_PER_CANDIDATE),
  };
}

export default getComparisonData;
