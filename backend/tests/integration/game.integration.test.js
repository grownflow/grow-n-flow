const request = require('supertest');
const { app } = require('../../src/app');

describe('API Integration Tests', () => {
  test('GET / should return health check', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.text).toBe('Aquaponics backend running.');
  });

  test('GET /api should return API status', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);
    
    expect(response.body.message).toBe('API is running');
  });
});