import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  getApp,
  request,
  createUser,
  createOffice,
  createCandidate,
  createBill,
  createVote,
  createComparison,
  loginAgent,
  models,
} from './helpers.js';

async function makePair() {
  const office = await createOffice();
  const candidateA = await createCandidate({
    office,
    name: 'Alice Record',
    party: 'Independent',
  });
  const candidateB = await createCandidate({
    office,
    name: 'Bob Ballot',
    party: 'Independent',
  });

  const taxBill = await createBill({
    number: 'H.R. 11',
    title: 'Tax Transparency Act',
    summary: 'Requires public reporting of certain tax expenditures.',
    topics: ['taxes', 'labor'],
  });
  const energyBill = await createBill({
    number: 'H.R. 12',
    title: 'Grid Reliability Act',
    summary: 'Sets reliability standards for regional electric grids.',
    topics: ['energy'],
  });

  await createVote({
    candidate: candidateA,
    bill: taxBill,
    position: 'yes',
    castAt: new Date('2025-02-01T12:00:00.000Z'),
  });
  await createVote({
    candidate: candidateB,
    bill: taxBill,
    position: 'no',
    castAt: new Date('2025-02-02T12:00:00.000Z'),
  });
  await createVote({
    candidate: candidateA,
    bill: energyBill,
    position: 'absent',
    castAt: new Date('2025-02-03T12:00:00.000Z'),
  });
  await createVote({
    candidate: candidateB,
    bill: energyBill,
    position: 'no',
    castAt: new Date('2025-02-04T12:00:00.000Z'),
  });

  return { office, candidateA, candidateB, taxBill, energyBill };
}

async function authenticatedAgent({ email = 'comparer@example.com' } = {}) {
  const user = await createUser({ email });
  const agent = await loginAgent({ email, password: 'Password123' });
  return { user, agent };
}

describe('POST /api/comparisons', () => {
  it('requires authentication', async () => {
    const app = getApp();
    const { candidateA, candidateB } = await makePair();

    const res = await request(app).post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: String(candidateB._id),
    });

    expect(res.status).toBe(401);
  });

  it('rejects an invalid body with 400', async () => {
    const { candidateA } = await makePair();
    const { agent } = await authenticatedAgent();

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });

  it('rejects comparing a candidate to themselves', async () => {
    const { candidateA } = await makePair();
    const { agent } = await authenticatedAgent();

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: String(candidateA._id),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/different/i);
  });

  it('rejects candidates from different offices', async () => {
    const { candidateA } = await makePair();
    const otherOffice = await createOffice({ slug: 'other-office' });
    const outsider = await createCandidate({
      office: otherOffice,
      name: 'Other Office Person',
    });
    const { agent } = await authenticatedAgent();

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: String(outsider._id),
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/same office/i);
  });

  it('returns 404 when a candidate does not exist', async () => {
    const { candidateA } = await makePair();
    const { agent } = await authenticatedAgent();

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: new mongoose.Types.ObjectId().toString(),
    });

    expect(res.status).toBe(404);
  });

  it('creates a comparison with all three fake analyses and saves it', async () => {
    const { user, agent } = await authenticatedAgent({
      email: 'success@example.com',
    });
    const { office, candidateA, candidateB } = await makePair();
    const race = await models.Race.create({
      slug: 'test-race-2026',
      name: 'Test Race 2026',
      electionYear: 2026,
      office: office._id,
      state: 'GA',
      candidates: [candidateA._id, candidateB._id],
    });

    const res = await agent.post('/api/comparisons').send({
      candidateAId: String(candidateA._id),
      candidateBId: String(candidateB._id),
      raceId: String(race._id),
    });

    expect(res.status).toBe(201);
    const comparison = res.body.comparison;
    expect(comparison.race).toMatchObject({
      id: String(race._id),
      slug: 'test-race-2026',
      name: 'Test Race 2026',
      electionYear: 2026,
    });
    expect(comparison).toBeTruthy();
    expect(String(comparison.candidateA.id)).toBe(String(candidateA._id));
    expect(String(comparison.candidateB.id)).toBe(String(candidateB._id));
    expect(comparison.models).toHaveLength(3);
    expect(comparison.models.map((model) => model.key).sort()).toEqual([
      'deepseek',
      'grok',
      'minimax',
    ]);

    for (const model of comparison.models) {
      expect(model.ok).toBe(true);
      expect(model.analysis).toBeTruthy();
      expect(typeof model.analysis.summary).toBe('string');
      expect(Array.isArray(model.analysis.dimensions)).toBe(true);
      expect(['low', 'medium', 'high']).toContain(model.analysis.confidence);
    }

    expect(Array.isArray(comparison.billReferences)).toBe(true);
    expect(comparison.billReferences.length).toBeGreaterThan(0);
    expect(comparison.billReferences.map((bill) => bill.number)).toContain('H.R. 11');
    expect(
      comparison.billReferences.find((bill) => bill.number === 'H.R. 11')?.title
    ).toBe('Tax Transparency Act');
    expect(JSON.stringify(comparison.models)).toContain('Tax Transparency Act');

    const saved = await models.Comparison.findOne({ user: user._id });
    expect(saved).toBeTruthy();
    expect(saved.models).toHaveLength(3);
    expect(saved.billReferences.length).toBeGreaterThan(0);
    expect(String(saved.candidateA)).toBe(String(candidateA._id));
    expect(String(saved.candidateB)).toBe(String(candidateB._id));
  });
});

describe('GET /api/comparisons', () => {
  it('lists only the current user\u2019s comparisons with pagination', async () => {
    const { office, candidateA, candidateB } = await makePair();
    const { user: userA, agent: agentA } = await authenticatedAgent({
      email: 'history-a@example.com',
    });
    const { user: userB } = await authenticatedAgent({
      email: 'history-b@example.com',
    });

    await createComparison({
      user: userA,
      candidateA,
      candidateB,
      office,
    });
    await createComparison({
      user: userA,
      candidateA,
      candidateB,
      office,
    });
    await createComparison({
      user: userB,
      candidateA,
      candidateB,
      office,
    });

    const page1 = await agentA.get('/api/comparisons').query({
      page: 1,
      limit: 1,
    });

    expect(page1.status).toBe(200);
    expect(page1.body.comparisons).toHaveLength(1);
    expect(page1.body.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      pages: 2,
    });

    const page2 = await agentA.get('/api/comparisons').query({
      page: 2,
      limit: 1,
    });
    expect(page2.status).toBe(200);
    expect(page2.body.comparisons).toHaveLength(1);
    expect(page2.body.pagination.page).toBe(2);
  });

  it('requires authentication to list history', async () => {
    const app = getApp();
    const res = await request(app).get('/api/comparisons');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/comparisons/:id', () => {
  it('returns a comparison to its owner', async () => {
    const { office, candidateA, candidateB } = await makePair();
    const { user, agent } = await authenticatedAgent({
      email: 'owner@example.com',
    });
    const comparison = await createComparison({
      user,
      candidateA,
      candidateB,
      office,
    });

    const res = await agent.get(`/api/comparisons/${comparison._id}`);

    expect(res.status).toBe(200);
    expect(res.body.comparison.id).toBe(String(comparison._id));
    expect(res.body.comparison.candidateA.id).toBe(String(candidateA._id));
  });

  it('does not expose a comparison to another user', async () => {
    const { office, candidateA, candidateB } = await makePair();
    const { user } = await authenticatedAgent({
      email: 'real-owner@example.com',
    });
    const { agent: otherAgent } = await authenticatedAgent({
      email: 'other-user@example.com',
    });
    const comparison = await createComparison({
      user,
      candidateA,
      candidateB,
      office,
    });

    const res = await otherAgent.get(`/api/comparisons/${comparison._id}`);

    expect([403, 404]).toContain(res.status);
  });

  it('returns 404 for an unknown comparison', async () => {
    const { agent } = await authenticatedAgent({
      email: 'unknown-comparison@example.com',
    });

    const res = await agent.get(
      `/api/comparisons/${new mongoose.Types.ObjectId().toString()}`,
    );

    expect(res.status).toBe(404);
  });
});

describe('comparison rate limiting', () => {
  it('returns a JSON 429 after ten comparisons in the window', async () => {
    const { candidateA, candidateB } = await makePair();
    const { agent } = await authenticatedAgent({
      email: 'rate-limit@example.com',
    });
    const payload = {
      candidateAId: String(candidateA._id),
      candidateBId: String(candidateB._id),
    };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const res = await agent.post('/api/comparisons').send(payload);
      expect(res.status).toBe(201);
    }

    const limited = await agent.post('/api/comparisons').send(payload);

    expect(limited.status).toBe(429);
    expect(limited.headers['content-type']).toMatch(/json/);
    expect(limited.body.error?.message).toBeTruthy();
  });
});
