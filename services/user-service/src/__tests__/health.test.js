const request = require('supertest');
const app = require('../index');

describe('GET /health', () => {
  it('returns 200 and user-service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'user-service' });
  });
});
