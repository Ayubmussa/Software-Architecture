import request from 'supertest';
import { app } from '../index';

describe('GET /health', () => {
  it('returns 200 and api-gateway status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'api-gateway' });
  });
});
