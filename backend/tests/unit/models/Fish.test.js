const { Fish } = require('../../../src/game/models/Fish');

describe('Fish Model', () => {
  let fish;

  beforeEach(() => {
    fish = new Fish('Tilapia', 10);
  });

  test('should initialize with correct properties', () => {
    expect(fish.type).toBe('Tilapia');
    expect(fish.count).toBe(10);
    expect(fish.health).toBe(10);
    expect(fish.size).toBe(1.0);
  });

  test('should feed fish and update health', () => {
    const result = fish.feed(10);
    
    expect(result.foodUsed).toBeGreaterThan(0);
    expect(fish.health).toBeGreaterThanOrEqual(1);
  });

  test('should produce waste', () => {
    const waste = fish.produceWaste();
    expect(waste).toBe(fish.count * fish.ammoniaProductionRate);
  });
});