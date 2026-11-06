import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { createApp } from '../src/app.js';
import * as modelExports from '../src/models/index.js';
import { hashToken, generateToken } from '../src/utils/tokenHash.js';

export const request = supertest;

let cachedApp = null;
let sequence = 0;

function nextSequence() {
  sequence += 1;
  return sequence;
}

function model(name) {
  const resolved =
    modelExports[name] ||
    (modelExports.default ? modelExports.default[name] : null);
  if (!resolved) {
    throw new Error(`Model "${name}" is not exported by src/models/index.js`);
  }
  return resolved;
}

export function getApp() {
  if (!cachedApp) {
    cachedApp = createApp();
  }
  return cachedApp;
}

export async function resetAll() {
  if (mongoose.connection.readyState !== 1) return;
  const collections = await mongoose.connection.db.collections();
  await Promise.all(
    collections.map((collection) => collection.deleteMany({})),
  );
}

export async function createUser(overrides = {}) {
  const {
    verified = true,
    email = `user${nextSequence()}@example.com`,
    password = 'Password123',
    displayName = 'Test User',
    verificationToken,
    verificationExpiresAt,
    resetToken,
    resetExpiresAt,
    ...rest
  } = overrides;

  const passwordHash = await bcrypt.hash(password, 4);
  const data = {
    email: String(email).toLowerCase(),
    passwordHash,
    displayName,
    isVerified: verified,
    ...rest,
  };

  if (verificationToken) {
    data.verificationTokenHash = hashToken(verificationToken);
    data.verificationExpiresAt =
      verificationExpiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000);
  } else if (verificationExpiresAt) {
    data.verificationExpiresAt = verificationExpiresAt;
  }

  if (resetToken) {
    data.resetTokenHash = hashToken(resetToken);
    data.resetExpiresAt =
      resetExpiresAt || new Date(Date.now() + 60 * 60 * 1000);
  } else if (resetExpiresAt) {
    data.resetExpiresAt = resetExpiresAt;
  }

  const User = model('User');
  const user = await User.create(data);
  user.$locals.rawPassword = password;
  user.$locals.rawVerificationToken = verificationToken;
  return user;
}

export async function createOffice(overrides = {}) {
  const n = nextSequence();
  const Office = model('Office');
  return Office.create({
    slug: `office-${n}`,
    name: `Test Office ${n}`,
    level: 'federal',
    state: 'GA',
    district: null,
    description: `Synthetic office ${n} used by tests.`,
    ...overrides,
  });
}

export async function createCandidate(overrides = {}) {
  const n = nextSequence();
  const Candidate = model('Candidate');
  const { office, ...rest } = overrides;
  const officeId = office
    ? office._id || office.id || office
    : (await createOffice())._id;

  return Candidate.create({
    slug: `candidate-${n}`,
    name: `Test Candidate ${n}`,
    party: 'Independent',
    office: officeId,
    state: 'GA',
    district: null,
    bio: 'This biography must never reach the AI prompt.',
    officialUrl: 'https://example.com/candidate',
    isSample: true,
    ...rest,
  });
}

export async function createBill(overrides = {}) {
  const n = nextSequence();
  const Bill = model('Bill');
  return Bill.create({
    congress: 119,
    chamber: 'house',
    number: `H.R. ${1000 + n}`,
    title: `Test Bill ${n}`,
    summary: `A neutral summary for synthetic bill ${n}.`,
    topics: ['taxes'],
    introducedAt: new Date('2025-01-15T12:00:00.000Z'),
    sponsor: 'Rep. Test',
    sourceUrl: `https://example.gov/bill/${n}`,
    isSample: true,
    ...overrides,
  });
}

export async function createVote(overrides = {}) {
  const {
    candidate,
    bill,
    position = 'yes',
    castAt,
    note,
    question,
    result,
  } = overrides;
  if (!candidate) throw new Error('createVote requires a candidate');
  if (!bill) throw new Error('createVote requires a bill');

  const Vote = model('Vote');
  return Vote.create({
    candidate: candidate._id || candidate.id || candidate,
    bill: bill._id || bill.id || bill,
    position,
    castAt: castAt || new Date('2025-02-01T12:00:00.000Z'),
    note: note || '',
    question,
    result,
  });
}

export async function createComparison(overrides = {}) {
  const { user, candidateA, candidateB, office, ...rest } = overrides;
  if (!user) throw new Error('createComparison requires a user');

  const Comparison = model('Comparison');
  return Comparison.create({
    user: user._id || user.id || user,
    candidateA: candidateA._id || candidateA.id || candidateA,
    candidateB: candidateB._id || candidateB.id || candidateB,
    office: office ? office._id || office.id || office : undefined,
    votesSnapshot: { candidateA: 0, candidateB: 0 },
    models: [],
    ...rest,
  });
}

export async function loginAgent({ email, password, app } = {}) {
  const targetApp = app || getApp();
  const agent = supertest.agent(targetApp);
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password });
  agent.token = response.body?.token;
  agent.loginResponse = response;
  return agent;
}

export async function createVerifiedUserAndAgent(overrides = {}) {
  const password = overrides.password || 'Password123';
  const user = await createUser({ ...overrides, password, verified: true });
  const agent = await loginAgent({ email: user.email, password });
  return { user, agent, password };
}

export { hashToken, generateToken };
export const models = {
  User: model('User'),
  Office: model('Office'),
  Candidate: model('Candidate'),
  Bill: model('Bill'),
  Vote: model('Vote'),
  Comparison: model('Comparison'),
  Race: model('Race'),
};

export default {
  getApp,
  request,
  resetAll,
  createUser,
  createOffice,
  createCandidate,
  createBill,
  createVote,
  createComparison,
  loginAgent,
};
