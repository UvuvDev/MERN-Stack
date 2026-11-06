const SCHEMA = `{
  "summary": "2-4 sentence neutral summary of how the two records differ.",
  "dimensions": [
    {
      "topic": "Taxes",
      "candidateA": "H.R. 9007 — Community Health Clinic Funding Act: voted yes.",
      "candidateB": "H.R. 9007 — Community Health Clinic Funding Act: voted no.",
      "difference": "Neutral description of the difference."
    }
  ],
  "candidateA": {
    "label": "Name",
    "strengths": ["Evidence-bound observation citing a bill number."],
    "concerns": ["Evidence-bound observation citing a bill number."]
  },
  "candidateB": {
    "label": "Name",
    "strengths": ["Evidence-bound observation citing a bill number."],
    "concerns": ["Evidence-bound observation citing a bill number."]
  },
  "sharedVotes": ["H.R. 1234 — Small Business Tax Simplification Act (both voted yes)"],
  "notableVotes": [
    { "bill": "H.R. 1234 — Small Business Tax Simplification Act", "why": "Why this vote is notable." }
  ],
  "confidence": "low | medium | high",
  "disclaimer": "AI interpretation of voting records only; not an endorsement."
}`;

const SYSTEM_PROMPT = `You are a nonpartisan legislative analyst producing an evidence-bound comparison of two legislators.

Rules you must follow:
1. Compare ONLY the recorded roll-call votes supplied by the user. Do not use outside knowledge.
2. Do not infer ideology, character, intent, or party alignment from a candidate's party affiliation, name, biography, statements, or reputation.
3. Every substantive claim must cite a specific bill from the supplied records using BOTH the number and its title: "H.R. 9007 — Community Health Clinic Funding Act" (or "S. 9101 — Clean Energy Grid Reliability Act"). Never cite a bare number like "H.R. 9007" when a title is supplied. If the records come from different Congresses, include the Congress: "S.J.Res. 89 (118th Congress) — Title".
4. Treat abstentions and absences distinctly from yes/no votes. Never count an absence or abstention as a yes, a no, or support for either side.
5. If the record is thin, incomplete, or does not support a conclusion, say so plainly and lower your confidence.
6. Be neutral and precise. Avoid persuasive language, endorsements, and predictions about future behavior.
7. Output STRICT JSON only. No markdown, no code fences, no commentary before or after the JSON.
8. The records may come from different Congresses, chambers, or time periods. Treat a bill as shared only when both the number AND the Congress match. Do not assume the same number in the 118th and 119th Congresses is the same bill. If the candidates did not serve together, sharedVotes may be empty; say so instead of inventing overlap.
9. Keep the output compact: a 3-sentence summary, at most 6 dimensions (only where the records actually differ), at most 2 strengths and 2 concerns per candidate, at most 8 shared votes, and at most 5 notable votes.

Output schema (all keys required):
${SCHEMA}
`;

function isoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function truncate(value, max) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function shapeBill(bill) {
  if (!bill) return null;
  return {
    number: bill.number ?? null,
    title: bill.title ?? null,
    summary: bill.summary ? truncate(bill.summary, 320) : null,
    topics: Array.isArray(bill.topics) ? bill.topics : [],
    chamber: bill.chamber ?? null,
    congress: bill.congress ?? null,
  };
}

function shapeRecords(records) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      if (!record) return null;
      const bill = shapeBill(record.bill);
      if (!bill || !bill.number) return null;
      return {
        bill,
        position: record.position ?? null,
        date: isoDate(record.castAt ?? record.date),
      };
    })
    .filter(Boolean);
}

export function buildComparisonPrompt({
  candidateA,
  candidateB,
  recordsA,
  recordsB,
}) {
  const payload = {
    task: 'Compare candidate A and candidate B using only their roll-call voting records.',
    evidenceRules: [
      'Party is shown only as a descriptive label. It is not evidence of any position and must not be used in your analysis.',
      'Compare positions vote by vote and topic by topic.',
      'Cite a specific bill number for every claim.',
      'Flag abstentions and absences separately from yes/no votes.',
      'Do not use biography, platform, campaign statements, endorsements, or rhetoric; none are provided.',
    ],
    candidates: {
      candidateA: {
        name: candidateA?.name ?? 'Candidate A',
        partyLabelOnly: candidateA?.party ?? null,
      },
      candidateB: {
        name: candidateB?.name ?? 'Candidate B',
        partyLabelOnly: candidateB?.party ?? null,
      },
    },
    records: {
      candidateA: shapeRecords(recordsA),
      candidateB: shapeRecords(recordsB),
    },
  };

  return {
    system: SYSTEM_PROMPT,
    user: JSON.stringify(payload),
  };
}

export default buildComparisonPrompt;
