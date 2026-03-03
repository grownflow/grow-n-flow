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
    expect(fish.ammoniaProductionRate).toBe(0.1);
    expect(fish.foodConsumptionRate).toBe(0.2);
    expect(fish.growthRate).toBeGreaterThan(0); // baseGrowthRate from species
  });

  test('should feed fish and update properties correctly', () => {
    const initialHealth = fish.health;
    const initialSize = fish.size;
    
    const result = fish.feed(10);
    
    expect(result).toHaveProperty('foodUsed');
    expect(result).toHaveProperty('growth');
    expect(result.foodUsed).toBeGreaterThan(0);
    expect(result.growth).toBeGreaterThan(0);
    expect(fish.health).toBeGreaterThanOrEqual(1);
    expect(fish.size).toBeGreaterThan(initialSize);
  });

  test('should handle insufficient food by reducing health', () => {
    const result = fish.feed(0.5); // Very little food
    
    expect(result.foodUsed).toBeLessThan(fish.count * fish.foodConsumptionRate);
    expect(fish.health).toBeLessThan(10); // Should be reduced due to insufficient food
  });

  test('should produce waste proportional to fish count', () => {
    const waste = fish.produceWaste();
    expect(waste).toBe(fish.count * fish.ammoniaProductionRate);
    expect(waste).toBe(10 * 0.1); // 10 fish * 0.1 ammonia rate = 1.0
  });

  test('should maintain minimum health of 1', () => {
    // Feed very little food multiple times to stress the fish
    for (let i = 0; i < 20; i++) {
      fish.feed(0.1);
    }
    
    expect(fish.health).toBeGreaterThanOrEqual(1);
  });

  test('should cap health at maximum of 10', () => {
    // Feed lots of food to boost health
    for (let i = 0; i < 10; i++) {
      fish.feed(100);
    }
    
    expect(fish.health).toBeLessThanOrEqual(10);
  });
});