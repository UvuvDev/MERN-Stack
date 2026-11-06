import { createHash, randomBytes } from 'node:crypto';

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function generateToken() {
  return randomBytes(32).toString('hex');
}

export const tokenHash = hashToken;
export const sha256Hex = hashToken;

export default hashToken;
