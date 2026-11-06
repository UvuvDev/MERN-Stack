import { describe, it, expect } from 'vitest';
import { getApp, request } from './helpers.js';

describe('GET /api/health', () => {
  it('reports ok with a connected database', async () => {
    const res = await request(getApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('connected');
    expect(typeof res.body.uptime).toBe('number');
  });
});
