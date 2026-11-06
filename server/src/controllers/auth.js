import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';
import * as tokenHashUtils from '../utils/tokenHash.js';
import { signToken } from '../services/auth/tokens.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email/mailer.js';

const BCRYPT_ROUNDS = 12;
const COOKIE_NAME = 'ror_token';
const SESSION_HINT_COOKIE = 'ror_session';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const DUPLICATE_MESSAGE = 'An account with this e-mail may already exist.';

function sha256Hex(value) {
  const fn =
    tokenHashUtils.sha256Hex ||
    tokenHashUtils.hashToken ||
    tokenHashUtils.tokenHash ||
    tokenHashUtils.default;
  if (typeof fn !== 'function') {
    throw new Error('tokenHash utility does not export a hash function');
  }
  return fn(value);
}

function generateRawToken() {
  return randomBytes(32).toString('hex');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function getId(value) {
  if (!value) return undefined;
  return value._id ?? value.id;
}

export function publicUser(user) {
  if (!user) return null;
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const result = {
    id: getId(source),
    email: source.email,
    displayName: source.displayName,
    isVerified: Boolean(source.isVerified),
  };
  if (source.createdAt) result.createdAt = source.createdAt;
  if (source.lastLoginAt) result.lastLoginAt = source.lastLoginAt;
  return result;
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(env.cookieSecure),
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
  res.cookie(SESSION_HINT_COOKIE, '1', {
    httpOnly: false,
    sameSite: 'lax',
    secure: Boolean(env.cookieSecure),
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: Boolean(env.cookieSecure),
    path: '/',
  });
  res.clearCookie(SESSION_HINT_COOKIE, {
    httpOnly: false,
    sameSite: 'lax',
    secure: Boolean(env.cookieSecure),
    path: '/',
  });
}

async function deliverVerificationEmail(user, token) {
  try {
    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      token,
    });
  } catch (err) {
    logger.error('Failed to send verification e-mail:', err?.message || err);
  }
}

async function deliverPasswordResetEmail(user, token) {
  try {
    await sendPasswordResetEmail({
      to: user.email,
      displayName: user.displayName,
      token,
    });
  } catch (err) {
    logger.error('Failed to send password reset e-mail:', err?.message || err);
  }
}

export const register = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const displayName = String(req.body.displayName || '').trim();
  const { password } = req.body;

  const existing = await User.exists({ email });
  if (existing) {
    throw new HttpError(409, DUPLICATE_MESSAGE);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const rawToken = generateRawToken();

  let user;
  try {
    user = await User.create({
      email,
      passwordHash,
      displayName,
      isVerified: false,
      verificationTokenHash: sha256Hex(rawToken),
      verificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new HttpError(409, DUPLICATE_MESSAGE);
    }
    throw err;
  }

  await deliverVerificationEmail(user, rawToken);

  res.status(201).json({
    message: 'Account created. Check your e-mail to verify your address.',
    user: {
      id: getId(user),
      email: user.email,
      displayName: user.displayName,
      isVerified: Boolean(user.isVerified),
    },
  });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) {
    throw new HttpError(400, 'Verification token is required.');
  }

  const user = await User.findOne({
    verificationTokenHash: sha256Hex(token),
    verificationExpiresAt: { $gt: new Date() },
  }).select('+verificationTokenHash');

  if (!user) {
    throw new HttpError(400, 'Invalid or expired verification token.');
  }

  user.isVerified = true;
  user.verificationTokenHash = undefined;
  user.verificationExpiresAt = undefined;
  await user.save();

  res.json({
    message: 'E-mail verified successfully.',
    user: publicUser(user),
  });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });

  if (user && !user.isVerified) {
    const rawToken = generateRawToken();
    user.verificationTokenHash = sha256Hex(rawToken);
    user.verificationExpiresAt = new Date(
      Date.now() + VERIFICATION_TTL_MS,
    );
    await user.save();
    await deliverVerificationEmail(user, rawToken);
  }

  res.json({
    message:
      'If an account exists for that e-mail, a verification link has been sent.',
  });
});

export const login = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.passwordHash) {
    throw new HttpError(401, 'Invalid e-mail or password.');
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new HttpError(401, 'Invalid e-mail or password.');
  }

  if (!user.isVerified) {
    res.status(403).json({
      error: {
        message: 'Please verify your e-mail address before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      },
    });
    return;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  setAuthCookie(res, token);

  res.json({ token, user: publicUser(user) });
});

export const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out.' });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email });

  if (user) {
    const rawToken = generateRawToken();
    user.resetTokenHash = sha256Hex(rawToken);
    user.resetExpiresAt = new Date(Date.now() + RESET_TTL_MS);
    await user.save();
    await deliverPasswordResetEmail(user, rawToken);
  }

  res.json({
    message:
      'If an account exists for that e-mail, a password reset link has been sent.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const { password } = req.body;

  const user = await User.findOne({
    resetTokenHash: sha256Hex(token),
    resetExpiresAt: { $gt: new Date() },
  }).select('+resetTokenHash +passwordHash');

  if (!user) {
    throw new HttpError(400, 'Invalid or expired password reset token.');
  }

  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.resetTokenHash = undefined;
  user.resetExpiresAt = undefined;
  await user.save();

  res.json({ message: 'Password updated. You can now sign in.' });
});

export default {
  register,
  verifyEmail,
  resendVerification,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
};
