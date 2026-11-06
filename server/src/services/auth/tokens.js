import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function signToken(user) {
  const id = user?._id || user?.id;
  if (!id) {
    throw new Error('signToken requires a user with an id');
  }
  return jwt.sign(
    { sub: String(id), email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

export default verifyToken;
