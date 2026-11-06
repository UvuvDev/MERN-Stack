import { describe, it, expect, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { parseJsonTolerant } from '../src/utils/parseJson.js';
import { buildComparisonPrompt } from '../src/services/ai/prompt.js';
import {
  MODEL_DEFINITIONS,
  buildDeterministicAnalysis,
  compareVotingRecords,
} from '../src/services/ai/compare.js';

const candidateA = {
  id: 'candidate-a',
  name: 'Alice Record',
  party: 'Independent',
  bio: 'TOP-SECRET-BIO',
  officialUrl: 'https://secret.example/official',
  photoUrl: 'https://secret.example/photo.jpg',
  platform: 'TOP-SECRET-PLATFORM',
};

const candidateB = {
  id: 'candidate-b',
  name: 'Bob Ballot',
  party: 'Independent',
  bio: 'TOP-SECRET-BIO-B',
};

const bill = {
  id: 'bill-1',
  number: 'H.R. 11',
  title: 'Tax Transparency Act',
  summary: 'Requires public reporting of certain tax expenditures.',
  topics: ['taxes'],
  chamber: 'house',
  congress: 119,
};

const recordsA = [
  {
    position: 'yes',
    castAt: new Date('2025-02-01T12:00:00.000Z'),
    bill,
  },
  {
    position: 'absent',
    castAt: new Date('2025-02-03T12:00:00.000Z'),
    bill: { ...bill, id: 'bill-2', number: 'H.R. 12', topics: ['energy'] },
  },
];

const recordsB = [
  {
    position: 'no',
    castAt: new Date('2025-02-02T12:00:00.000Z'),
    bill,
  },
  {
    position: 'no',
    castAt: new Date('2025-02-04T12:00:00.000Z'),
    bill: { ...bill, id: 'bill-2', number: 'H.R. 12', topics: ['energy'] },
  },
];

describe('AI prompt construction', () => {
  it('never includes bio, platform, photo, or official URLs', () => {
    const { system, user } = buildComparisonPrompt({
      candidateA,
      candidateB,
      recordsA,
      recordsB,
    });

    expect(user).not.toContain('TOP-SECRET-BIO');
    expect(user).not.toContain('TOP-SECRET-PLATFORM');
    expect(user).not.toContain('secret.example');
    expect(user).not.toContain('photo.jpg');

    const payload = JSON.parse(user);
    expect(payload.candidates.candidateA).toEqual({
      name: 'Alice Record',
      partyLabelOnly: 'Independent',
    });
    expect(payload.records.candidateA[0].bill.number).toBe('H.R. 11');
    expect(payload.records.candidateA[0].date).toBe(
      '2025-02-01T12:00:00.000Z',
    );
    expect(payload.records.candidateA[0].position).toBe('yes');

    expect(system).toMatch(/nonpartisan/i);
    expect(system).toMatch(/voting records/i);
    expect(system).toMatch(/party/i);
    expect(system).toMatch(/abstention/i);
    expect(system).toMatch(/JSON/i);
    expect(system).toMatch(/"sharedVotes"/);
    expect(system).toMatch(/"confidence"/);
  });
});

describe('deterministic AI analysis', () => {
  it('derives distinct canned analyses from the vote data', () => {
    const minimax = buildDeterministicAnalysis({
      key: 'minimax',
      candidateA,
      candidateB,
      recordsA,
      recordsB,
    });
    const deepseek = buildDeterministicAnalysis({
      key: 'deepseek',
      candidateA,
      candidateB,
      recordsA,
      recordsB,
    });
    const grok = buildDeterministicAnalysis({
      key: 'grok',
      candidateA,
      candidateB,
      recordsA,
      recordsB,
    });

    expect(minimax.summary).not.toBe(deepseek.summary);
    expect(deepseek.summary).not.toBe(grok.summary);
    expect(minimax.summary).toContain('Alice Record');
    expect(minimax.summary).toContain('Bob Ballot');
    expect(minimax.demoMode).toBe(true);
    expect(minimax.sharedVotes).toEqual([]);
    expect(minimax.dimensions.length).toBeGreaterThan(0);
    expect(minimax.notableVotes.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(minimax.confidence);
  });
});

describe('compareVotingRecords', () => {
  it('always returns an entry for all three models without throwing', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network disabled in tests'));

    try {
      const result = await compareVotingRecords({
        candidateA,
        candidateB,
        recordsA,
        recordsB,
      });

      expect(result.models.map((model) => model.key)).toEqual(
        MODEL_DEFINITIONS.map((model) => model.key),
      );
      expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);

      const fakeMode =
        env.openrouter.fake ||
        !env.openrouter.enabled ||
        !env.openrouter.apiKey;
      if (fakeMode) {
        for (const model of result.models) {
          expect(model.ok).toBe(true);
          expect(model.analysis.demoMode).toBe(true);
        }
      } else {
        for (const model of result.models) {
          expect(typeof model.ok).toBe('boolean');
        }
      }
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('tolerant JSON parsing', () => {
  it('strips markdown fences and extracts embedded JSON', () => {
    expect(parseJsonTolerant('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonTolerant('prefix {"b":2} suffix')).toEqual({ b: 2 });
  });
});
