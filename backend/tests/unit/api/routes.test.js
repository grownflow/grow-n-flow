const request = require('supertest');
const express = require('express');
const routes = require('../../../src/api/routes/index');
const { close } = require('../../../src/db');

// Create a test app with the routes
const app = express();
app.use(express.json());
app.use('/api', routes);

describe('API Routes', () => {
  let matchID;

  afterAll(async () => {
    await close();
  });

  test('GET /api should return API status message', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);
    
    expect(response.body).toEqual({ message: "API is running" });
  });

  test('POST /api/games/aquaponics/create should create a match', async () => {
    const response = await request(app)
      .post('/api/games/aquaponics/create')
      .send({})
      .expect(200);
    
    expect(response.body).toHaveProperty('matchID');
    expect(typeof response.body.matchID).toBe('string');
    matchID = response.body.matchID;
  });

  test('GET /api/games/aquaponics/:matchID should return game state', async () => {
    // Create a match first
    const createResponse = await request(app)
      .post('/api/games/aquaponics/create')
      .send({});
    const testMatchID = createResponse.body.matchID;

    const response = await request(app)
      .get(`/api/games/aquaponics/${testMatchID}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('G');
    expect(response.body).toHaveProperty('ctx');
    expect(response.body.G).toHaveProperty('fish');
    expect(response.body.G).toHaveProperty('gameTime');
  });

  test('POST /api/games/aquaponics/:matchID/move should execute addFish move', async () => {
    // Create a match first
    const createResponse = await request(app)
      .post('/api/games/aquaponics/create')
      .send({});
    const testMatchID = createResponse.body.matchID;

    const response = await request(app)
      .post(`/api/games/aquaponics/${testMatchID}/move`)
      .send({
        move: 'addFish',
        args: ['tilapia', 3],
        playerID: '0'
      })
      .expect(200);
    
    expect(response.body).toHaveProperty('G');
    expect(response.body.G.fish).toHaveLength(1);
    expect(response.body.G.fish[0].type).toBe('tilapia');
    expect(response.body.G.fish[0].count).toBe(3);
  });

  test('POST /api/games/aquaponics/:matchID/move should return error for invalid move', async () => {
    // Create a match first
    const createResponse = await request(app)
      .post('/api/games/aquaponics/create')
      .send({});
    const testMatchID = createResponse.body.matchID;

    const response = await request(app)
      .post(`/api/games/aquaponics/${testMatchID}/move`)
      .send({
        move: 'invalidMove',
        args: [],
        playerID: '0'
      })
      .expect(400);
    
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('invalidMove not found');
  });

  test('GET /api/nonexistent should return 404', async () => {
    await request(app)
      .get('/api/nonexistent')
      .expect(404);
  });
});