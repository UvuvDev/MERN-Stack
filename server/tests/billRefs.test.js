import { describe, expect, it } from 'vitest';
import {
  buildBillReferenceMap,
  canonicalBillNumber,
  collectCitedBills,
  congressLabel,
  enrichAnalysisWithBillTitles,
  enrichTextWithBillTitles,
} from '../src/utils/billRefs.js';

const records = [
  {
    bill: {
      number: 'H.R. 9007',
      title: 'Community Health Clinic Funding Act',
      summary: 'Funds community health clinics.',
      topics: ['healthcare'],
      sourceUrl: 'https://www.congress.gov/bill/119/house-bill/9007',
    },
  },
  {
    bill: {
      number: 'S. 9101',
      title: 'Clean Energy Grid Reliability Act',
      summary: 'Sets grid reliability standards.',
      topics: ['energy'],
    },
  },
];

describe('bill reference helpers', () => {
  it('canonicalizes the bill number formats a model might emit', () => {
    expect(canonicalBillNumber('H.R. 9007')).toBe('H.R. 9007');
    expect(canonicalBillNumber('HR 9007')).toBe('H.R. 9007');
    expect(canonicalBillNumber('H.R.9007')).toBe('H.R. 9007');
    expect(canonicalBillNumber('H.Res. 5')).toBe('H.Res. 5');
    expect(canonicalBillNumber('HCONRES 3')).toBe('H.Con.Res. 3');
    expect(canonicalBillNumber('SJRES 4')).toBe('S.J.Res. 4');
    expect(canonicalBillNumber('S. 9101')).toBe('S. 9101');
    expect(canonicalBillNumber('not a bill')).toBeNull();
  });

  it('adds titles without duplicating an existing citation title', () => {
    const map = buildBillReferenceMap(records, []);
    expect(enrichTextWithBillTitles('They split on H.R. 9007.', map)).toBe(
      'They split on H.R. 9007 — Community Health Clinic Funding Act.'
    );
    expect(
      enrichTextWithBillTitles(
        'They split on H.R. 9007 — Community Health Clinic Funding Act.',
        map
      )
    ).toBe('They split on H.R. 9007 — Community Health Clinic Funding Act.');
    expect(enrichTextWithBillTitles('No bill here.', map)).toBe('No bill here.');
  });

  it('separates the same bill number in different Congresses', () => {
    const map = buildBillReferenceMap(
      [
        {
          bill: {
            number: 'S.J.Res. 89',
            congress: 118,
            title: '118th Congress resolution',
          },
        },
      ],
      [
        {
          bill: {
            number: 'S.J.Res. 89',
            congress: 119,
            title: '119th Congress resolution',
          },
        },
      ]
    );

    expect(congressLabel(118)).toBe('118th Congress');
    expect(congressLabel(119)).toBe('119th Congress');

    const cited = collectCitedBills(
      [
        {
          analysis: {
            summary: 'They split on S.J.Res. 89 (119th Congress) — 119th Congress resolution.',
          },
        },
      ],
      map
    );
    expect(cited).toHaveLength(1);
    expect(cited[0].congress).toBe(119);
    expect(cited[0].citation).toBe('S.J.Res. 89 (119th Congress)');

    const ambiguous = collectCitedBills(
      [{ analysis: { summary: 'They split on S.J.Res. 89.' } }],
      map
    );
    expect(ambiguous).toHaveLength(2);
    expect(ambiguous.map((bill) => bill.congress).sort()).toEqual([118, 119]);
  });

  it('enriches every text field in an analysis and collects cited bills', () => {
    const map = buildBillReferenceMap(records, []);
    const analysis = {
      summary: 'H.R. 9007 and S. 9101 drove the split.',
      dimensions: [
        {
          topic: 'healthcare',
          candidateA: 'Voted yes on H.R. 9007.',
          candidateB: 'Voted no on H.R. 9007.',
          difference: 'H.R. 9007.',
        },
      ],
      candidateA: { label: 'A', strengths: ['H.R. 9007 yes'], concerns: [] },
      candidateB: { label: 'B', strengths: [], concerns: ['S. 9101 no'] },
      sharedVotes: ['H.R. 9007 — both voted yes'],
      notableVotes: [{ bill: 'S. 9101', why: 'Split vote.' }],
      confidence: 'high',
      disclaimer: 'Not an endorsement.',
    };

    const enriched = enrichAnalysisWithBillTitles(analysis, map);
    expect(enriched.summary).toContain('H.R. 9007 — Community Health Clinic Funding Act');
    expect(enriched.summary).toContain('S. 9101 — Clean Energy Grid Reliability Act');
    expect(enriched.dimensions[0].difference).toContain('Community Health Clinic Funding Act');
    expect(enriched.notableVotes[0].bill).toContain('Clean Energy Grid Reliability Act');
    expect(analysis.summary).not.toContain('Community Health Clinic Funding Act');

    const cited = collectCitedBills([{ analysis: enriched }], map);
    expect(cited.map((bill) => bill.number)).toEqual(['H.R. 9007', 'S. 9101']);
    expect(cited[0].title).toBe('Community Health Clinic Funding Act');
  });
});
