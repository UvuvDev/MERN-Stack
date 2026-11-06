import { verifyToken } from '../services/auth/tokens.js';
import { getModel } from '../utils/models.js';

function extractToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header === 'string') {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }
  if (req.cookies && typeof req.cookies.ror_token === 'string') {
    return req.cookies.ror_token;
  }
  return null;
}

async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload || !payload.sub) return null;

  const User = getModel('User');
  const user = await User.findById(payload.sub)
    .select('-passwordHash -verificationTokenHash -resetTokenHash')
    .lean();

  if (!user) return null;
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHENTICATED',
        },
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (user) {
      req.user = user;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export default requireAuth;
