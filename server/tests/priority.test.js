import { describe, expect, it } from 'vitest';
import {
  getApp,
  request,
  createUser,
  createOffice,
  createCandidate,
  createBill,
  createVote,
  loginAgent,
  models,
} from './helpers.js';
import { buildPriorityMeasureResults } from '../src/services/priorityMeasures.js';
import { buildComparisonPrompt } from '../src/services/ai/prompt.js';

describe('priority measure service', () => {
  it('returns recorded positions and explicit no-vote states', () => {
    const results = buildPriorityMeasureResults({
      candidateA: { id: 'a', name: 'Alice Record' },
      candidateB: { id: 'b', name: 'Bob Ballot' },
      recordsA: [
        {
          bill: { number: 'H.R. 4405', priorityKey: 'epstein-hr4405' },
          position: 'yes',
          note: 'On Motion to Suspend the Rules and Pass — Passed 427–1',
          question: 'On Motion to Suspend the Rules and Pass',
          result: 'Passed 427–1',
          castAt: '2025-11-18T00:00:00.000Z',
        },
      ],
      recordsB: [
        {
          bill: {
            number: 'Epstein Amendment to S. 2296',
            priorityKey: 'epstein-s2296-amendment',
          },
          position: 'no',
          note: 'On the Motion to Table — Motion to Table Agreed to 51–49',
          question: 'On the Motion to Table',
          result: 'Motion to Table Agreed to 51–49',
          castAt: '2025-09-10T00:00:00.000Z',
        },
      ],
    });

    expect(results).toHaveLength(2);
    const [hr4405, amendment] = results;
    expect(hr4405.candidateA).toMatchObject({
      name: 'Alice Record',
      position: 'yes',
      result: 'Passed 427–1',
    });
    expect(hr4405.candidateB.position).toBeNull();
    expect(hr4405.candidateB.note).toMatch(/No recorded roll-call vote/i);
    expect(amendment.candidateA.position).toBeNull();
    expect(amendment.candidateB).toMatchObject({
      name: 'Bob Ballot',
      position: 'no',
      question: 'On the Motion to Table',
    });
  });

  it('names the Epstein measures and procedural context in the prompt', () => {
    const priorityMeasures = buildPriorityMeasureResults({
      candidateA: { id: 'a', name: 'Alice Record' },
      candidateB: { id: 'b', name: 'Bob Ballot' },
      recordsA: [],
      recordsB: [],
    });
    const prompt = buildComparisonPrompt({
      candidateA: { name: 'Alice Record' },
      candidateB: { name: 'Bob Ballot' },
      recordsA: [],
      recordsB: [],
      priorityMeasures,
    });

    expect(prompt.system).toContain('Epstein Files Transparency Act');
    expect(prompt.system).toContain('Epstein documents amendment to S.2296');
    expect(prompt.system).toContain('motion to table');
    expect(prompt.user).toContain('priorityMeasures');
    expect(prompt.user).toContain('No recorded roll-call vote');
  });
});

describe('priority measures in comparisons', () => {
  it('stores and returns the priority positions', async () => {
    getApp();
    const office = await createOffice();
    const candidateA = await createCandidate({
      office,
      name: 'Alice Record',
    });
    const candidateB = await createCandidate({
      office,
      name: 'Bob Ballot',
    });

    const hr4405 = await createBill({
      number: 'H.R. 4405',
      title: 'Epstein Files Transparency Act',
      priorityKey: 'epstein-hr4405',
    });
    const amendment = await createBill({
      number: 'Epstein Amendment to S. 2296',
      chamber: 'senate',
      title: 'Epstein Documents Amendment to the FY2026 National Defense Authorization Act',
      priorityKey: 'epstein-s2296-amendment',
    });

    await createVote({
      candidate: candidateA,
      bill: hr4405,
      position: 'yes',
      question: 'On Motion to Suspend the Rules and Pass',
      result: 'Passed 427–1',
    });
    await createVote({
      candidate: candidateB,
      bill: amendment,
      position: 'no',
      question: 'On the Motion to Table',
      result: 'Motion to Table Agreed to 51–49',
    });

    const user = await createUser({ email: 'priority@example.com' });
    const agent = await loginAgent({
      email: 'priority@example.com',
      password: 'Password123',
    });

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: String(candidateB._id),
    });

    expect(res.status).toBe(201);
    const comparison = res.body.comparison;
    expect(comparison.priorityMeasures).toHaveLength(2);

    const hr = comparison.priorityMeasures.find(
      (measure) => measure.key === 'epstein-hr4405'
    );
    expect(hr.candidateA).toMatchObject({
      name: 'Alice Record',
      position: 'yes',
      result: 'Passed 427–1',
    });
    expect(hr.candidateB.position).toBeNull();

    const amend = comparison.priorityMeasures.find(
      (measure) => measure.key === 'epstein-s2296-amendment'
    );
    expect(amend.candidateA.position).toBeNull();
    expect(amend.candidateB).toMatchObject({
      name: 'Bob Ballot',
      position: 'no',
      question: 'On the Motion to Table',
    });

    const fakeAnalysis = comparison.models[0].analysis;
    expect(fakeAnalysis.priorityMeasures).toHaveLength(2);
    expect(JSON.stringify(fakeAnalysis.priorityMeasures)).toContain('Epstein');

    const saved = await models.Comparison.findOne({ user: user._id });
    expect(saved.priorityMeasures).toHaveLength(2);
  });
});
