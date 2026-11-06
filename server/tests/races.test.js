import { describe, expect, it } from 'vitest';
import {
  getApp,
  request,
  createOffice,
  createCandidate,
  createBill,
  createVote,
  models,
} from './helpers.js';

async function makeRace() {
  const office = await createOffice({ slug: 'us-senate-oh', name: 'U.S. Senate — Ohio' });
  const candidateA = await createCandidate({
    office,
    name: 'Jon Husted',
    party: 'Republican',
    bioguideId: 'H001104',
  });
  const candidateB = await createCandidate({
    office,
    name: 'Sherrod Brown',
    party: 'Democratic',
    bioguideId: 'B000944',
  });

  const bill118 = await createBill({
    number: 'S. 100',
    congress: 118,
    title: '118th Test Act',
  });
  const bill119 = await createBill({
    number: 'S. 200',
    congress: 119,
    title: '119th Test Act',
  });

  await createVote({ candidate: candidateA, bill: bill119, position: 'yes' });
  await createVote({ candidate: candidateB, bill: bill118, position: 'no' });

  const race = await models.Race.create({
    slug: 'ohio-us-senate-2026',
    name: 'Ohio U.S. Senate 2026',
    electionYear: 2026,
    office: office._id,
    state: 'OH',
    candidates: [candidateA._id, candidateB._id],
    description: 'Test race.',
  });

  return { office, candidateA, candidateB, race };
}

describe('GET /api/races', () => {
  it('lists races with candidate vote counts and filters', async () => {
    await makeRace();
    const app = getApp();

    const all = await request(app).get('/api/races');
    expect(all.status).toBe(200);
    expect(all.body.races).toHaveLength(1);
    const race = all.body.races[0];
    expect(race.name).toBe('Ohio U.S. Senate 2026');
    expect(race.candidates.map((candidate) => candidate.name)).toEqual([
      'Jon Husted',
      'Sherrod Brown',
    ]);
    expect(race.candidates.map((candidate) => candidate.voteCount)).toEqual([1, 1]);

    const filtered = await request(app).get('/api/races?year=2026&state=OH');
    expect(filtered.status).toBe(200);
    expect(filtered.body.races).toHaveLength(1);

    const none = await request(app).get('/api/races?year=2024');
    expect(none.status).toBe(200);
    expect(none.body.races).toHaveLength(0);
  });

  it('reports races with incomplete nominee records', async () => {
    const { office, candidateA } = await makeRace();
    const incomplete = await models.Race.create({
      slug: 'incomplete-race-2026',
      name: 'Incomplete Race 2026',
      electionYear: 2026,
      office: office._id,
      candidates: [candidateA._id],
      missingNominees: [
        { name: 'Unlisted Nominee', party: 'Independent', reason: 'No record.' },
      ],
    });

    const app = getApp();
    const res = await request(app).get(`/api/races/${incomplete.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.race.comparable).toBe(false);
    expect(res.body.race.missingNominees[0].name).toBe('Unlisted Nominee');
  });

  it('returns a race by slug and id, and 404s for unknown races', async () => {
    const { race } = await makeRace();
    const app = getApp();

    const bySlug = await request(app).get('/api/races/ohio-us-senate-2026');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.race.name).toBe('Ohio U.S. Senate 2026');

    const byId = await request(app).get(`/api/races/${race._id}`);
    expect(byId.status).toBe(200);
    expect(String(byId.body.race.id)).toBe(String(race._id));

    const missing = await request(app).get('/api/races/not-a-race');
    expect(missing.status).toBe(404);
  });
});
