import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  getApp,
  request,
  createUser,
  loginAgent,
  hashToken,
  models,
} from './helpers.js';

function cookieHeader(res) {
  return (res.headers['set-cookie'] || []).join('; ');
}

describe('auth: registration', () => {
  it('registers a user with a hashed password and unverified status', async () => {
    const app = getApp();
    const res = await request(app).post('/api/auth/register').send({
      email: 'new.user@example.com',
      password: 'Password123',
      displayName: 'New User',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBeTruthy();
    expect(res.body.user.email).toBe('new.user@example.com');
    expect(res.body.user.isVerified).toBe(false);
    expect(res.body.user.passwordHash).toBeUndefined();

    const user = await models.User.findOne({
      email: 'new.user@example.com',
    }).select('+passwordHash +verificationTokenHash');

    expect(user).toBeTruthy();
    expect(user.passwordHash).not.toBe('Password123');
    expect(await bcrypt.compare('Password123', user.passwordHash)).toBe(true);
    expect(user.verificationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(user.verificationExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a duplicate e-mail', async () => {
    const app = getApp();
    await createUser({ email: 'dupe@example.com' });

    const res = await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com',
      password: 'Password123',
      displayName: 'Duplicate User',
    });

    expect(res.status).toBe(409);
    expect(res.body.error?.message).toBeTruthy();
  });

  it('rejects invalid registration bodies with 400 and details', async () => {
    const app = getApp();
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'short',
      displayName: 'A',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('auth: e-mail verification', () => {
  it('verifies a user with a valid token', async () => {
    const app = getApp();
    const rawToken = 'verification-token-valid';
    const user = await createUser({
      email: 'verify@example.com',
      verified: false,
      verificationToken: rawToken,
    });

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.user.isVerified).toBe(true);

    const updated = await models.User.findById(user._id).select(
      '+verificationTokenHash',
    );
    expect(updated.isVerified).toBe(true);
    expect(updated.verificationTokenHash).toBeUndefined();
  });

  it('rejects an unknown verification token', async () => {
    const app = getApp();
    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: 'does-not-exist' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });

  it('rejects an expired verification token', async () => {
    const app = getApp();
    const rawToken = 'verification-token-expired';
    await createUser({
      email: 'expired@example.com',
      verified: false,
      verificationToken: rawToken,
      verificationExpiresAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app)
      .get('/api/auth/verify-email')
      .query({ token: rawToken });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });
});

describe('auth: resend verification', () => {
  it('issues a new token for an existing unverified user', async () => {
    const app = getApp();
    const user = await createUser({
      email: 'resend@example.com',
      verified: false,
      verificationToken: 'old-token',
    });

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'resend@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();

    const updated = await models.User.findById(user._id).select(
      '+verificationTokenHash',
    );
    expect(updated.verificationTokenHash).toBeTruthy();
    expect(updated.verificationTokenHash).not.toBe(hashToken('old-token'));
  });

  it('returns a generic response for an unknown e-mail', async () => {
    const app = getApp();
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it('returns the same generic response for an already verified user', async () => {
    const app = getApp();
    await createUser({ email: 'already@example.com', verified: true });

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'already@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });
});

describe('auth: login, session and logout', () => {
  it('logs in, returns a token and sets the ror_token cookie', async () => {
    const app = getApp();
    const user = await createUser({
      email: 'login@example.com',
      password: 'Password123',
      verified: true,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'Password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.user.id).toBe(String(user._id));
    expect(cookieHeader(res)).toMatch(/ror_token=/);
    expect(cookieHeader(res)).toMatch(/HttpOnly/i);
  });

  it('rejects a wrong password with 401', async () => {
    const app = getApp();
    await createUser({
      email: 'wrongpass@example.com',
      password: 'Password123',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrongpass@example.com', password: 'WrongPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBeTruthy();
  });

  it('blocks unverified users with 403 EMAIL_NOT_VERIFIED', async () => {
    const app = getApp();
    await createUser({
      email: 'unverified@example.com',
      password: 'Password123',
      verified: false,
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unverified@example.com', password: 'Password123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns the current user via bearer token', async () => {
    const app = getApp();
    const user = await createUser({ email: 'bearer@example.com' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bearer@example.com', password: 'Password123' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(String(user._id));
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns the current user via the session cookie', async () => {
    const user = await createUser({ email: 'cookie@example.com' });
    const agent = await loginAgent({
      email: 'cookie@example.com',
      password: 'Password123',
    });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(String(user._id));
  });

  it('rejects /me without authentication', async () => {
    const app = getApp();
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('logs out and clears the cookie', async () => {
    await createUser({ email: 'logout@example.com' });
    const agent = await loginAgent({
      email: 'logout@example.com',
      password: 'Password123',
    });

    const res = await agent.post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
    expect(cookieHeader(res)).toMatch(/ror_token=/);

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(401);
  });
});

describe('auth: password reset', () => {
  it('issues a hashed reset token for an existing account', async () => {
    const app = getApp();
    const user = await createUser({ email: 'forgot@example.com' });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'forgot@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);

    const updated = await models.User.findById(user._id).select(
      '+resetTokenHash',
    );
    expect(updated.resetTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(updated.resetExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns the same generic message for an unknown account', async () => {
    const app = getApp();
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
  });

  it('resets the password with a valid token and invalidates it', async () => {
    const app = getApp();
    const rawToken = 'reset-token-valid';
    const user = await createUser({
      email: 'reset@example.com',
      password: 'Password123',
      resetToken: rawToken,
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NewPassword123' });

    expect(res.status).toBe(200);

    const updated = await models.User.findById(user._id).select(
      '+passwordHash +resetTokenHash',
    );
    expect(await bcrypt.compare('NewPassword123', updated.passwordHash)).toBe(
      true,
    );
    expect(await bcrypt.compare('Password123', updated.passwordHash)).toBe(
      false,
    );
    expect(updated.resetTokenHash).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reset@example.com', password: 'NewPassword123' });
    expect(login.status).toBe(200);

    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'AnotherPassword123' });
    expect(reuse.status).toBe(400);
  });

  it('rejects an invalid reset token', async () => {
    const app = getApp();
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'NewPassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });

  it('rejects an expired reset token', async () => {
    const app = getApp();
    const rawToken = 'reset-token-expired';
    await createUser({
      email: 'resetexpired@example.com',
      resetToken: rawToken,
      resetExpiresAt: new Date(Date.now() - 60 * 1000),
    });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, password: 'NewPassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });
});
