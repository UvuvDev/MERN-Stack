const PREFIX_LABELS = {
  HR: 'H.R.',
  HRES: 'H.Res.',
  HJRES: 'H.J.Res.',
  HCONRES: 'H.Con.Res.',
  S: 'S.',
  SRES: 'S.Res.',
  SJRES: 'S.J.Res.',
  SCONRES: 'S.Con.Res.',
};

// Longest prefixes first so H.Con.Res is not read as H.R.
const PREFIX_PATTERNS = [
  ['HCONRES', 'H\\.?\\s?CON\\.?\\s?RES\\.?'],
  ['HJRES', 'H\\.?\\s?J\\.?\\s?RES\\.?'],
  ['HRES', 'H\\.?\\s?RES\\.?'],
  ['HR', 'H\\.?\\s?R\\.?'],
  ['SCONRES', 'S\\.?\\s?CON\\.?\\s?RES\\.?'],
  ['SJRES', 'S\\.?\\s?J\\.?\\s?RES\\.?'],
  ['SRES', 'S\\.?\\s?RES\\.?'],
  ['S', 'S\\.?'],
];

const BILL_SOURCE = `\\b(${PREFIX_PATTERNS.map(([, pattern]) => pattern).join(
  '|'
)})\\s*\\.?\\s*(\\d{1,5})\\b`;

export const BILL_REFERENCE_PATTERN = new RegExp(BILL_SOURCE, 'gi');

function canonicalFromMatch(prefix, digits) {
  const key = String(prefix || '')
    .replace(/[.\s]/g, '')
    .toUpperCase();
  const label = PREFIX_LABELS[key];
  return label ? `${label} ${digits}` : null;
}

export function canonicalBillNumber(value) {
  if (!value) return null;
  const pattern = new RegExp(BILL_SOURCE, 'i');
  const match = pattern.exec(String(value));
  return match ? canonicalFromMatch(match[1], match[2]) : null;
}

export function congressLabel(congress) {
  const value = Number(congress);
  if (!Number.isFinite(value) || value <= 0) return '';
  const mod100 = value % 100;
  let suffix = 'th';
  if (mod100 < 11 || mod100 > 13) {
    if (value % 10 === 1) suffix = 'st';
    else if (value % 10 === 2) suffix = 'nd';
    else if (value % 10 === 3) suffix = 'rd';
  }
  return `${value}${suffix} Congress`;
}

function referenceFromBill(bill) {
  const number = canonicalBillNumber(bill && bill.number);
  if (!number) return null;
  const congress = Number(bill.congress) || null;
  return {
    number,
    congress,
    citation: congress ? `${number} (${congressLabel(congress)})` : number,
    title: bill.title || '',
    summary: bill.summary || '',
    sourceUrl: bill.sourceUrl || '',
    topics: Array.isArray(bill.topics) ? bill.topics : [],
  };
}

/**
 * Build a lookup of bill number -> possible bills. A number can appear in more
 * than one Congress, so callers must disambiguate with the title or Congress.
 */
export function buildBillReferenceMap(recordsA = [], recordsB = []) {
  const map = new Map();

  for (const record of [...(recordsA || []), ...(recordsB || [])]) {
    const reference = referenceFromBill(record && record.bill);
    if (!reference) continue;
    const list = map.get(reference.number) || [];
    if (!list.some((item) => item.citation === reference.citation)) {
      list.push(reference);
    }
    map.set(reference.number, list);
  }

  return map;
}

function chooseReference(fullText, offset, matchLength, references) {
  if (!Array.isArray(references) || references.length === 0) return null;
  if (references.length === 1) return references[0];

  const window = fullText.slice(
    Math.max(0, offset - 80),
    offset + matchLength + 600
  );
  const matches = references.filter(
    (reference) => reference.title && window.includes(reference.title)
  );
  // If two titles share a window the text is ambiguous; do not guess.
  return matches.length === 1 ? matches[0] : null;
}

export function enrichTextWithBillTitles(value, billMap) {
  if (typeof value !== 'string' || !value || !billMap || billMap.size === 0) {
    return value;
  }

  const pattern = new RegExp(BILL_SOURCE, 'gi');

  return value.replace(pattern, (match, prefix, digits, offset, fullText) => {
    const number = canonicalFromMatch(prefix, digits);
    const references = number ? billMap.get(number) : null;
    const reference = chooseReference(fullText, offset, match.length, references);
    if (!reference || !reference.title) return match;

    // Do not add the title twice if the model already supplied it before or
    // after the number (e.g. "the Tax Transparency Act (H.R. 11)").
    const tail = fullText.slice(
      offset + match.length,
      offset + match.length + reference.title.length + 8
    );
    const head = fullText.slice(
      Math.max(0, offset - reference.title.length - 8),
      offset
    );
    if (tail.includes(reference.title) || head.includes(reference.title)) {
      return match;
    }

    return `${match} — ${reference.title}`;
  });
}

/**
 * Add descriptive bill titles to every string in a model analysis.
 * This is deterministic, so the UI stays readable even when a model cites
 * only "H.R. 9007" instead of "H.R. 9007 — Community Health Clinic Funding Act".
 */
export function enrichAnalysisWithBillTitles(analysis, billMap) {
  if (!analysis || typeof analysis !== 'object' || !billMap || billMap.size === 0) {
    return analysis;
  }

  const clone = JSON.parse(JSON.stringify(analysis));
  const enrich = (value) => enrichTextWithBillTitles(value, billMap);

  clone.summary = enrich(clone.summary);
  clone.dimensions = (clone.dimensions || []).map((dimension) => ({
    ...dimension,
    topic: enrich(dimension.topic),
    candidateA: enrich(dimension.candidateA),
    candidateB: enrich(dimension.candidateB),
    difference: enrich(dimension.difference),
  }));

  for (const side of ['candidateA', 'candidateB']) {
    if (clone[side] && typeof clone[side] === 'object') {
      clone[side].strengths = (clone[side].strengths || []).map(enrich);
      clone[side].concerns = (clone[side].concerns || []).map(enrich);
    }
  }

  clone.sharedVotes = (clone.sharedVotes || []).map(enrich);
  clone.notableVotes = (clone.notableVotes || []).map((item) => {
    if (typeof item === 'string') return enrich(item);
    if (!item || typeof item !== 'object') return item;
    return {
      ...item,
      bill: enrich(item.bill),
      why: enrich(item.why),
    };
  });

  return clone;
}

function collectStrings(value, output) {
  if (typeof value === 'string') {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
}

/**
 * Return the unique bills actually cited across the model analyses, with
 * titles and neutral summaries for a reference list in the UI.
 */
export function collectCitedBills(models = [], billMap) {
  if (!billMap || billMap.size === 0) return [];

  const texts = [];
  for (const model of models || []) {
    if (model && model.analysis) collectStrings(model.analysis, texts);
  }

  const references = new Map();
  for (const value of texts) {
    const pattern = new RegExp(BILL_SOURCE, 'gi');
    let match = pattern.exec(value);
    while (match) {
      const number = canonicalFromMatch(match[1], match[2]);
      const candidates = number ? billMap.get(number) : null;
      if (candidates && candidates.length > 0) {
        const chosen = chooseReference(value, match.index, match[0].length, candidates);
        // If a bare number is ambiguous, list every bill with that number
        // rather than silently attributing the wrong title.
        (chosen ? [chosen] : candidates).forEach((reference) => {
          references.set(reference.citation, reference);
        });
      }
      match = pattern.exec(value);
    }
  }

  return [...references.values()]
    .sort(
      (a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }) ||
        (a.congress || 0) - (b.congress || 0)
    )
    .map((bill) => ({
      number: bill.number,
      citation: bill.citation,
      congress: bill.congress,
      title: bill.title || 'Untitled bill',
      summary: bill.summary || '',
      sourceUrl: bill.sourceUrl || '',
      topics: bill.topics || [],
    }));
}

export default {
  BILL_REFERENCE_PATTERN,
  buildBillReferenceMap,
  canonicalBillNumber,
  collectCitedBills,
  congressLabel,
  enrichAnalysisWithBillTitles,
  enrichTextWithBillTitles,
};
