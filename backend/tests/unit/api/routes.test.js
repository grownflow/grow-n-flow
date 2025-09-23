const request = require('supertest');
const express = require('express');
const routes = require('../../../src/api/routes/index');

// Create a test app with the routes
const app = express();
app.use('/api', routes);

describe('API Routes', () => {
  test('GET /api should return API status message', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);
    
    expect(response.body).toEqual({ message: "API is running" });
  });

  test('GET /api should return JSON content type', async () => {
    const response = await request(app)
      .get('/api')
      .expect('Content-Type', /json/);
    
    expect(response.status).toBe(200);
  });

  test('GET /api/nonexistent should return 404', async () => {
    await request(app)
      .get('/api/nonexistent')
      .expect(404);
  });
});