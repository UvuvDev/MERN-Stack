import rateLimit, { MemoryStore } from 'express-rate-limit';

const authStore = new MemoryStore();
const compareStore = new MemoryStore();

export const rateLimitStores = {
  auth: authStore,
  compare: compareStore,
};

function rejectWith(windowMs, message) {
  return (_req, res) => {
    const retryAfter = Math.ceil(windowMs / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: {
        message,
        code: 'RATE_LIMITED',
        details: { retryAfterSeconds: retryAfter },
      },
    });
  };
}

export const authLimiter = rateLimit({
  store: authStore,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejectWith(
    15 * 60 * 1000,
    'Too many authentication attempts. Please try again later.',
  ),
});

function compareKey(req) {
  if (req.user && req.user._id) {
    return `user:${String(req.user._id)}`;
  }
  if (req.user && req.user.id) {
    return `user:${String(req.user.id)}`;
  }
  return `ip:${req.ip}`;
}

export const compareLimiter = rateLimit({
  store: compareStore,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: compareKey,
  handler: rejectWith(
    60 * 60 * 1000,
    'Comparison limit reached. Please try again later.',
  ),
});
