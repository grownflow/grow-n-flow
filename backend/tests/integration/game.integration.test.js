const request = require('supertest');
const { app } = require('../../src/app');
const { close } = require('../../src/db');

describe('Game Integration Tests', () => {
  let matchID;

  afterAll(async () => {
    await close();
  });

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

  test('Full game workflow: create match, add fish, plant seeds, progress days', async () => {
    // Create match
    const createResponse = await request(app)
      .post('/api/games/aquaponics/create')
      .send({})
      .expect(200);
    
    matchID = createResponse.body.matchID;
    expect(matchID).toBeDefined();

    // Add fish
    const addFishResponse = await request(app)
      .post(`/api/games/aquaponics/${matchID}/move`)
      .send({
        move: 'addFish',
        args: ['tilapia', 5],
        playerID: '0'
      })
      .expect(200);
    
    expect(addFishResponse.body.G.fish).toHaveLength(1);
    expect(addFishResponse.body.G.fish[0].type).toBe('tilapia');

    // Plant seeds
    await request(app)
      .post(`/api/games/aquaponics/${matchID}/move`)
      .send({
        move: 'plantSeed',
        args: ['ParrisIslandRomaine', 'bed1'],
        playerID: '0'
      })
      .expect(200);

    // Feed fish
    const feedResponse = await request(app)
      .post(`/api/games/aquaponics/${matchID}/move`)
      .send({
        move: 'feedFish',
        args: [0, 10],
        playerID: '0'
      })
      .expect(200);
    
    // feedFish doesn't increment gameTime, but it triggers simulation
    expect(feedResponse.body.G.lastAction).toBeDefined();
    expect(feedResponse.body.G.lastAction.type).toBe('feedFish');

    // Progress turn
    const progressResponse = await request(app)
      .post(`/api/games/aquaponics/${matchID}/move`)
      .send({
        move: 'progressTurn',
        args: [],
        playerID: '0'
      })
      .expect(200);
    
    expect(progressResponse.body.G.gameTime).toBeGreaterThan(feedResponse.body.G.gameTime);

    // Check final state
    const stateResponse = await request(app)
      .get(`/api/games/aquaponics/${matchID}`)
      .expect(200);
    
    expect(stateResponse.body.G.fish).toHaveLength(1);
    expect(stateResponse.body.G.aquaponicsSystem).toBeDefined();
    expect(stateResponse.body.ctx.turn).toBeGreaterThan(1);
  });
});