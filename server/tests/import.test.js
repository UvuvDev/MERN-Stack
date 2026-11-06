import { describe, expect, it } from 'vitest';
import {
  castCodeToPosition,
  formatMemberName,
  inferTopics,
  normalizeBillNumber,
  officeNameFor,
  officeSlugFor,
  partyFromCode,
  selectRollCalls,
  stateName,
  stripHtml,
} from '../src/import/realData.js';

describe('real data import helpers', () => {
  it('normalizes bill numbers from Voteview into display and API forms', () => {
    expect(normalizeBillNumber('HR1')).toMatchObject({
      number: 'H.R. 1',
      chamber: 'house',
      apiType: 'hr',
      urlType: 'house-bill',
      digits: '1',
    });
    expect(normalizeBillNumber('S 5')).toMatchObject({
      number: 'S. 5',
      chamber: 'senate',
      apiType: 's',
    });
    expect(normalizeBillNumber('HRES 12')).toMatchObject({
      number: 'H.Res. 12',
      chamber: 'house',
    });
    expect(normalizeBillNumber('SCONRES7')).toMatchObject({
      number: 'S.Con.Res. 7',
      chamber: 'senate',
    });
    expect(normalizeBillNumber('')).toBeNull();
    expect(normalizeBillNumber('NOMINATION')).toBeNull();
  });

  it('maps Voteview cast codes to stored positions', () => {
    expect(castCodeToPosition(1)).toBe('yes');
    expect(castCodeToPosition('2')).toBe('yes');
    expect(castCodeToPosition(3)).toBe('yes');
    expect(castCodeToPosition(4)).toBe('no');
    expect(castCodeToPosition(5)).toBe('no');
    expect(castCodeToPosition(6)).toBe('no');
    expect(castCodeToPosition(7)).toBe('abstain');
    expect(castCodeToPosition(8)).toBe('abstain');
    expect(castCodeToPosition(9)).toBe('absent');
    expect(castCodeToPosition(0)).toBeNull();
  });

  it('maps party codes and formats member names', () => {
    expect(partyFromCode(100)).toBe('Democratic');
    expect(partyFromCode('200')).toBe('Republican');
    expect(partyFromCode(328)).toBe('Independent');
    expect(partyFromCode(999)).toBe('Other');

    expect(formatMemberName('DIAZ-BALART, Mario')).toBe('Mario Diaz-Balart');
    expect(formatMemberName('SCOTT, Richard Lynn (Rick)')).toBe('Richard Lynn Scott');
    expect(formatMemberName('OCASIO-CORTEZ, Alexandria')).toBe('Alexandria Ocasio-Cortez');
    expect(formatMemberName('')).toBe('Unknown Member');
  });

  it('builds stable real-data office slugs and names', () => {
    expect(officeSlugFor('house', 'fl')).toBe('real-us-house-fl');
    expect(officeSlugFor('senate', 'FL')).toBe('real-us-senate-fl');
    expect(officeNameFor('house', 'FL')).toBe('U.S. House — Florida (all districts)');
    expect(officeNameFor('senate', 'FL')).toBe('U.S. Senate — Florida');
    expect(stateName('FL')).toBe('Florida');
    expect(stateName('ZZ')).toBe('ZZ');
  });

  it('infers useful topics when Congress.gov metadata is unavailable', () => {
    expect(inferTopics('A bill to amend the Internal Revenue Code to reduce tax rates')).toContain(
      'taxes'
    );
    expect(
      inferTopics('A bill to improve border security and asylum processing')
    ).toContain('immigration');
    expect(inferTopics('A resolution honoring a local sports team')).toEqual(['General']);
  });

  it('strips HTML from Congress.gov summaries', () => {
    expect(stripHtml('<p>Tax <strong>relief</strong> &amp; credits</p>')).toBe(
      'Tax relief & credits'
    );
    expect(stripHtml('<ul><li>One</li><li>Two</li></ul>')).toBe('One Two');
  });

  it('selects the most substantive roll call per bill and chamber', () => {
    const rows = [
      {
        chamber: 'House',
        rollnumber: '10',
        date: '2025-02-01',
        bill_number: 'HR1',
        vote_question: 'On Motion to Proceed',
        vote_result: 'Agreed to',
        yea_count: '200',
        nay_count: '190',
      },
      {
        chamber: 'House',
        rollnumber: '12',
        date: '2025-02-03',
        bill_number: 'HR1',
        vote_question: 'On Passage',
        vote_result: 'Passed',
        yea_count: '218',
        nay_count: '210',
      },
      {
        chamber: 'Senate',
        rollnumber: '4',
        date: '2025-02-05',
        bill_number: 'HR1',
        vote_question: 'On Passage of the Bill',
        vote_result: 'Passed',
        yea_count: '60',
        nay_count: '40',
      },
      {
        chamber: 'House',
        rollnumber: '20',
        date: '2025-03-01',
        bill_number: 'HRES5',
        vote_question: 'On Agreeing to the Resolution',
        vote_result: 'Passed',
        yea_count: '215',
        nay_count: '210',
      },
      {
        chamber: 'House',
        rollnumber: '30',
        date: '2025-04-01',
        bill_number: '',
        vote_question: 'On Quorum',
        vote_result: 'Passed',
        yea_count: '0',
        nay_count: '0',
      },
    ];

    const selected = selectRollCalls(rows);
    expect(selected).toHaveLength(3);
    const houseHr1 = selected.find(
      (row) => row.bill.number === 'H.R. 1' && row.chamber === 'house'
    );
    expect(houseHr1.rollnumber).toBe('12');
    expect(selected.some((row) => row.bill.number === 'H.R. 1' && row.chamber === 'senate')).toBe(
      true
    );
    expect(selectRollCalls(rows, { limit: 2 })).toHaveLength(2);
    expect(selectRollCalls(rows, { chamber: 'house' })).toHaveLength(2);
    expect(selectRollCalls(rows, { chamber: 'senate' })).toHaveLength(1);
  });
});
