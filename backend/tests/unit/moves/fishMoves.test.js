const fishMoves = require('../../../src/game/moves/fishMoves');
const { Fish } = require('../../../src/game/models/Fish');
const { AquaponicsSystem } = require('../../../src/game/models/AquaponicsSystem');

describe('Fish Moves', () => {
  let G, ctx;

  beforeEach(() => {
    G = {
      fish: [],
      plants: [],
      aquaponicsSystem: new AquaponicsSystem(),
      gameTime: 0,
      money: 500,
      lastAction: null
    };
    ctx = { currentPlayer: '0', turn: 1 };
  });

  test('addFish should add fish to game state', () => {
    const result = fishMoves.addFish(G, ctx, 'tilapia', 5);
    
    expect(result.fish).toHaveLength(1);
    expect(result.fish[0]).toBeInstanceOf(Fish);
    expect(result.fish[0].type).toBe('tilapia');
    expect(result.fish[0].count).toBe(5);
  });

  test('addFish should have correct species parameters', () => {
    const result = fishMoves.addFish(G, ctx, 'tilapia', 5);
    const fish = result.fish[0];
    
    expect(fish.ammoniaProductionRate).toBe(0.1);
    expect(fish.foodConsumptionRate).toBe(0.2);
    expect(fish.species.marketValue).toBe(3);
  });

  test('feedFish should feed existing fish', () => {
    const addResult = fishMoves.addFish(G, ctx, 'tilapia', 3);
    const feedResult = fishMoves.feedFish(addResult, ctx, 0, 10);
    
    expect(feedResult.fish[0].age).toBe(1);
    expect(feedResult.lastAction.type).toBe('feedFish');
  });

  test('feedFish should return unchanged state for invalid fish index', () => {
    const result = fishMoves.feedFish(G, ctx, 99, 10);
    
    expect(result.fish).toHaveLength(0);
    expect(result.gameTime).toBe(0);
  });

  test('addFish should allow multiple additions', () => {
    let result = fishMoves.addFish(G, ctx, 'tilapia', 5);
    result = fishMoves.addFish(result, ctx, 'barramundi', 3);
    
    expect(result.fish).toHaveLength(2);
    expect(result.fish[0].type).toBe('tilapia');
    expect(result.fish[1].type).toBe('barramundi');
  });
});