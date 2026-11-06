import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  getApp,
  request,
  createOffice,
  createCandidate,
  createBill,
  createVote,
} from './helpers.js';

describe('public offices', () => {
  it('lists offices', async () => {
    const app = getApp();
    const office = await createOffice({
      slug: 'us-senate-ga',
      name: 'U.S. Senate — Georgia',
      level: 'federal',
      state: 'GA',
      description: 'A test office.',
    });

    const res = await request(app).get('/api/offices');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.offices)).toBe(true);
    expect(res.body.offices).toHaveLength(1);
    expect(res.body.offices[0]).toMatchObject({
      id: String(office._id),
      slug: 'us-senate-ga',
      name: 'U.S. Senate — Georgia',
      level: 'federal',
      state: 'GA',
      description: 'A test office.',
    });
  });
});

describe('public candidates', () => {
  it('lists all candidates with vote counts', async () => {
    const app = getApp();
    const office = await createOffice();
    const candidate = await createCandidate({ office, name: 'Alice Alpha' });
    const bill = await createBill();
    await createVote({ candidate, bill, position: 'yes' });

    const res = await request(app).get('/api/candidates');

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].id).toBe(String(candidate._id));
    expect(res.body.candidates[0].voteCount).toBe(1);
    expect(res.body.candidates[0].passwordHash).toBeUndefined();
  });

  it('filters candidates by office slug', async () => {
    const app = getApp();
    const officeA = await createOffice({ slug: 'office-a' });
    const officeB = await createOffice({ slug: 'office-b' });
    await createCandidate({ office: officeA, name: 'Alice Alpha' });
    await createCandidate({ office: officeB, name: 'Bob Beta' });

    const res = await request(app)
      .get('/api/candidates')
      .query({ office: 'office-a' });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].name).toBe('Alice Alpha');
  });

  it('searches candidates by name', async () => {
    const app = getApp();
    const office = await createOffice();
    await createCandidate({ office, name: 'Alice Alpha' });
    await createCandidate({ office, name: 'Bob Beta' });

    const res = await request(app)
      .get('/api/candidates')
      .query({ search: 'beta' });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0].name).toBe('Bob Beta');
  });

  it('honors the limit query parameter', async () => {
    const app = getApp();
    const office = await createOffice();
    await createCandidate({ office, name: 'Alice Alpha' });
    await createCandidate({ office, name: 'Bob Beta' });
    await createCandidate({ office, name: 'Carol Gamma' });

    const res = await request(app).get('/api/candidates').query({ limit: 2 });

    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(2);
  });

  it('returns candidate detail with votes', async () => {
    const app = getApp();
    const office = await createOffice();
    const candidate = await createCandidate({
      office,
      name: 'Detail Person',
      bio: 'Bio sent to the UI but never to the AI.',
    });
    const bill = await createBill({
      number: 'H.R. 4242',
      title: 'A Detail Bill',
      topics: ['labor'],
    });
    await createVote({
      candidate,
      bill,
      position: 'no',
      castAt: new Date('2025-03-01T12:00:00.000Z'),
    });

    const res = await request(app).get(`/api/candidates/${candidate._id}`);

    expect(res.status).toBe(200);
    expect(res.body.candidate.id).toBe(String(candidate._id));
    expect(res.body.candidate.bio).toBe(
      'Bio sent to the UI but never to the AI.',
    );
    expect(res.body.candidate.votes).toHaveLength(1);
    expect(res.body.candidate.votes[0].position).toBe('no');
    expect(res.body.candidate.votes[0].bill.number).toBe('H.R. 4242');
  });

  it('returns 404 for an unknown candidate detail', async () => {
    const app = getApp();
    const res = await request(app).get(
      `/api/candidates/${new mongoose.Types.ObjectId().toString()}`,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBeTruthy();
  });

  it('returns 404 for votes of an unknown candidate', async () => {
    const app = getApp();
    const res = await request(app).get(
      `/api/candidates/${new mongoose.Types.ObjectId().toString()}/votes`,
    );

    expect(res.status).toBe(404);
  });

  it('returns a candidate vote history', async () => {
    const app = getApp();
    const office = await createOffice();
    const candidate = await createCandidate({ office });
    const bill = await createBill();
    await createVote({ candidate, bill, position: 'abstain' });

    const res = await request(app).get(
      `/api/candidates/${candidate._id}/votes`,
    );

    expect(res.status).toBe(200);
    expect(res.body.votes).toHaveLength(1);
    expect(res.body.votes[0].position).toBe('abstain');
  });
});

describe('API documentation and unknown routes', () => {
  it('serves the OpenAPI document', async () => {
    const app = getApp();
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.info?.title).toBeTruthy();
    expect(res.body.paths).toBeTruthy();
    expect(Object.keys(res.body.paths)).toContain('/api/comparisons');
  });

  it('serves Swagger UI as HTML', async () => {
    const app = getApp();
    const res = await request(app).get('/api/docs').redirects(1);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('returns JSON for an unknown API route', async () => {
    const app = getApp();
    const res = await request(app).get('/api/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error?.message).toBeTruthy();
  });
});
