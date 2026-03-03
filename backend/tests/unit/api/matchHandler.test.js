const { MatchHandler } = require('../../../src/api/matchHandler');
const { close } = require('../../../src/db');

describe('MatchHandler', () => {
  afterAll(async () => {
    await close();
  });
  test('should create a match with valid matchID', async () => {
    const result = await MatchHandler.create();
    
    expect(result).toHaveProperty('matchID');
    expect(typeof result.matchID).toBe('string');
    expect(result.matchID.length).toBeGreaterThan(0);
  });

  test('should retrieve created match', async () => {
    const created = await MatchHandler.create();
    const match = await MatchHandler.getMatch(created.matchID);
    
    expect(match).toBeDefined();
    expect(match).toHaveProperty('G');
    expect(match).toHaveProperty('ctx');
    expect(match.G).toHaveProperty('fish');
    expect(match.G).toHaveProperty('gameTime');
    expect(match.ctx).toHaveProperty('currentPlayer');
  });

  test('should return null for non-existent match', async () => {
    const match = await MatchHandler.getMatch('nonexistent');
    expect(match).toBeNull();
  });

  test('should execute addFish move successfully', async () => {
    const created = await MatchHandler.create();
    const result = await MatchHandler.makeMove(created.matchID, 'addFish', ['tilapia', 3], '0');
    
    expect(result).toHaveProperty('G');
    expect(result).toHaveProperty('ctx');
    expect(result.G.fish).toHaveLength(1);
    expect(result.G.fish[0].type).toBe('tilapia');
    expect(result.G.fish[0].count).toBe(3);
    expect(result.ctx.turn).toBe(2);
  });

  test('should execute multiple moves in sequence', async () => {
    const created = await MatchHandler.create();
    
    // Add fish
    const addResult = await MatchHandler.makeMove(created.matchID, 'addFish', ['tilapia', 2], '0');
    expect(addResult.G.fish).toHaveLength(1);
    
    // Progress turn
    const progressResult = await MatchHandler.makeMove(created.matchID, 'progressTurn', [], '0');
    expect(progressResult.G.gameTime).toBe(1);
    expect(progressResult.ctx.turn).toBe(3);
  });

  test('should throw error for non-existent match', async () => {
    await expect(
      MatchHandler.makeMove('nonexistent', 'addFish', ['tilapia', 1], '0')
    ).rejects.toThrow('Match not found');
  });

  test('should throw error for invalid move', async () => {
    const created = await MatchHandler.create();
    
    await expect(
      MatchHandler.makeMove(created.matchID, 'invalidMove', [], '0')
    ).rejects.toThrow('Move invalidMove not found');
  });

  test('should handle invalid fish index gracefully', async () => {
    const created = await MatchHandler.create();
    
    const result = await MatchHandler.makeMove(created.matchID, 'feedFish', [99, 10], '0');
    
    expect(result).toHaveProperty('G');
    expect(result.G.fish).toHaveLength(0);
    expect(result.ctx.turn).toBe(2);
  });
});