const fishMoves = require('../../../src/game/moves/fishMoves');
const { WATER_VOLUME_BOUNDS } = require('../../../src/game/data/renderBounds');

describe('fishMoves.addFish', () => {
  const makeState = (money = 5000) => ({
    fish: [],
    plants: [],
    money,
    gameTime: 0,
    lastAction: null,
  });

  const ctx = { currentPlayer: '0', turn: 1 };

  test('adds requested fish with render metadata', () => {
    const G = makeState();

    fishMoves.addFish({ G, ctx }, 'tilapia', 2);

    expect(G.fish).toHaveLength(2);
    expect(G.fish[0].type).toBe('tilapia');
    expect(G.fish[0].renderAsset).toBe('3d/Redheadx.x3d');
    expect(G.fish[0].renderScale).toBe(0.3);
    expect(G.lastAction.success).toBe(true);
  });

  test('spawns fish positions inside configured water volume', () => {
    const G = makeState();

    fishMoves.addFish({ G, ctx }, 'barramundi', 8);

    expect(G.fish).toHaveLength(8);
    G.fish.forEach((fish) => {
      expect(fish.renderPosition.x).toBeGreaterThanOrEqual(WATER_VOLUME_BOUNDS.minX);
      expect(fish.renderPosition.x).toBeLessThanOrEqual(WATER_VOLUME_BOUNDS.maxX);
      expect(fish.renderPosition.y).toBeGreaterThanOrEqual(WATER_VOLUME_BOUNDS.minY);
      expect(fish.renderPosition.y).toBeLessThanOrEqual(WATER_VOLUME_BOUNDS.maxY);
      expect(fish.renderPosition.z).toBeGreaterThanOrEqual(WATER_VOLUME_BOUNDS.minZ);
      expect(fish.renderPosition.z).toBeLessThanOrEqual(WATER_VOLUME_BOUNDS.maxZ);
    });
  });

  test('fails for unknown species', () => {
    const G = makeState();

    fishMoves.addFish({ G, ctx }, 'unknownFish', 1);

    expect(G.fish).toHaveLength(0);
    expect(G.lastAction).toEqual({ type: 'addFish', success: false, reason: 'unknown_species' });
  });

  test('fails for insufficient funds', () => {
    const G = makeState(1);

    fishMoves.addFish({ G, ctx }, 'barramundi', 1);

    expect(G.fish).toHaveLength(0);
    expect(G.lastAction).toEqual({ type: 'addFish', success: false, reason: 'insufficient_funds' });
  });
});
