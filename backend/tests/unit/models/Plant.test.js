const { Plant } = require('../../../src/game/models/Plant');
const { WaterChemistry } = require('../../../src/game/models/WaterChemistry');

describe('Plant Model', () => {
  let plant;
  let optimalWater;

  beforeEach(() => {
    plant = new Plant('plant_1', 'ParrisIslandRomaine');
    
    // Create optimal water chemistry conditions
    optimalWater = new WaterChemistry();
    optimalWater.pH = 6.5;
    optimalWater.nitrate = 10;
    optimalWater.phosphorus = 5;
    optimalWater.potassium = 40;
    optimalWater.calcium = 60;
    optimalWater.magnesium = 20;
    optimalWater.iron = 2;
  });

  describe('Initialization', () => {
    test('should initialize with correct properties', () => {
      expect(plant.id).toBe('plant_1');
      expect(plant.type).toBe('ParrisIslandRomaine');
      expect(plant.health).toBe(100);
      expect(plant.weeksGrown).toBe(0);
      expect(plant.maturity).toBe(0);
      expect(plant.deficiencies).toEqual([]);
    });

    test('should throw error for unknown plant species', () => {
      expect(() => new Plant('plant_2', 'UnknownPlant')).toThrow('Unknown plant species: UnknownPlant');
    });
  });

  describe('Growth with optimal conditions', () => {
    test('should grow at 100% rate with optimal water chemistry and light', () => {
      const result = plant.grow(optimalWater, true);
      
      expect(result.success).toBe(true);
      expect(result.growthRate).toBe(1.0);
      expect(plant.daysGrown).toBe(1);
      expect(result.weeksGrown).toBe(0); // 1 day = 0 weeks (floor(1/7))
      expect(result.maturity).toBeCloseTo(3.57, 1); // 100% / 28 days = 3.57% per day
      expect(result.health).toBe(100);
      expect(result.deficiencies).toEqual([]);
      expect(result.pHPenalty).toBe(0);
    });

    test('should reach maturity after growth period', () => {
      // Grow for 28 days (full growth period for 4-week crop)
      for (let i = 0; i < 28; i++) {
        plant.grow(optimalWater, true);
      }
      
      expect(plant.daysGrown).toBe(28);
      expect(plant.weeksGrown).toBe(4); // floor(28/7)
      expect(plant.maturity).toBeCloseTo(100, 0);
      expect(plant.canHarvest()).toBe(true);
    });

    test('should maintain health with optimal conditions', () => {
      for (let i = 0; i < 4; i++) {
        plant.grow(optimalWater, true);
      }
      
      expect(plant.health).toBe(100);
    });
  });

  describe('Light requirements', () => {
    test('should not grow without light', () => {
      const result = plant.grow(optimalWater, false);
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('No light available');
      expect(result.growthRate).toBe(0);
      expect(plant.weeksGrown).toBe(0);
      expect(plant.maturity).toBe(0);
    });
  });

  describe('pH effects', () => {
    test('should have no penalty at optimal pH (6.5)', () => {
      optimalWater.pH = 6.5;
      const result = plant.grow(optimalWater, true);
      
      expect(result.pHPenalty).toBe(0);
      expect(result.growthRate).toBe(1.0);
    });

    test('should have mild penalty with pH deviation 0.5-1.0', () => {
      optimalWater.pH = 7.1; // 0.6 deviation
      const result = plant.grow(optimalWater, true);
      
      expect(result.pHPenalty).toBe(0.15);
      expect(result.growthRate).toBe(0.85);
    });

    test('should have severe penalty with pH deviation > 1.0', () => {
      optimalWater.pH = 5.4; // 1.1 deviation
      const result = plant.grow(optimalWater, true);
      
      expect(result.pHPenalty).toBe(0.3);
      expect(result.growthRate).toBe(0.7);
    });

    test('should reduce health over time with bad pH', () => {
      optimalWater.pH = 5.0;
      
      for (let i = 0; i < 4; i++) {
        plant.grow(optimalWater, true);
      }
      
      expect(plant.health).toBeLessThan(100);
    });
  });

  describe('Nitrogen deficiency', () => {
    test('should detect nitrogen deficiency when nitrate is low', () => {
      optimalWater.nitrate = 2; // Below requirement of 5
      const result = plant.grow(optimalWater, true);
      
      expect(result.deficiencies).toHaveLength(1);
      expect(result.deficiencies[0].nutrient).toBe('nitrogen');
      expect(result.deficiencies[0].symptom).toBe('yellowing_leaves');
      expect(result.deficiencies[0].severity).toBeDefined();
    });

    test('should reduce growth rate with nitrogen deficiency', () => {
      optimalWater.nitrate = 1; // Severe deficiency (20% of requirement)
      const result = plant.grow(optimalWater, true);
      
      expect(result.growthRate).toBeLessThan(1.0);
      expect(result.nutrientPenalties.nitrogen).toBeGreaterThan(0);
    });

    test('should show severe nitrogen deficiency with very low nitrate', () => {
      optimalWater.nitrate = 0.5; // 10% of requirement
      const result = plant.grow(optimalWater, true);
      
      expect(result.deficiencies[0].severity).toBe('severe');
    });
  });

  describe('Phosphorus deficiency', () => {
    test('should detect phosphorus deficiency', () => {
      optimalWater.phosphorus = 1; // Below requirement of 3
      const result = plant.grow(optimalWater, true);
      
      const pDeficiency = result.deficiencies.find(d => d.nutrient === 'phosphorus');
      expect(pDeficiency).toBeDefined();
      expect(pDeficiency.symptom).toBe('burnt_edges');
    });

    test('should reduce growth rate with phosphorus deficiency', () => {
      optimalWater.phosphorus = 0.5;
      const result = plant.grow(optimalWater, true);
      
      expect(result.nutrientPenalties.phosphorus).toBeGreaterThan(0);
      expect(result.growthRate).toBeLessThan(1.0);
    });
  });

  describe('Potassium deficiency', () => {
    test('should detect potassium deficiency', () => {
      optimalWater.potassium = 15; // Below requirement of 30
      const result = plant.grow(optimalWater, true);
      
      const kDeficiency = result.deficiencies.find(d => d.nutrient === 'potassium');
      expect(kDeficiency).toBeDefined();
      expect(kDeficiency.symptom).toBe('scorched_margins_with_black_spots');
    });
  });

  describe('Calcium deficiency', () => {
    test('should detect calcium deficiency', () => {
      optimalWater.calcium = 25; // Below requirement of 50
      const result = plant.grow(optimalWater, true);
      
      const caDeficiency = result.deficiencies.find(d => d.nutrient === 'calcium');
      expect(caDeficiency).toBeDefined();
      expect(caDeficiency.symptom).toBe('tip_burn_and_deformed_leaves');
    });
  });

  describe('Magnesium deficiency', () => {
    test('should detect magnesium deficiency', () => {
      optimalWater.magnesium = 7; // Below requirement of 15
      const result = plant.grow(optimalWater, true);
      
      const mgDeficiency = result.deficiencies.find(d => d.nutrient === 'magnesium');
      expect(mgDeficiency).toBeDefined();
      expect(mgDeficiency.symptom).toBe('chlorosis_on_old_leaves');
    });
  });

  describe('Iron deficiency', () => {
    test('should detect iron deficiency', () => {
      optimalWater.iron = 0.4; // Below requirement of 1
      const result = plant.grow(optimalWater, true);
      
      const feDeficiency = result.deficiencies.find(d => d.nutrient === 'iron');
      expect(feDeficiency).toBeDefined();
      expect(feDeficiency.symptom).toBe('chlorosis_on_new_leaves');
    });
  });

  describe('Multiple deficiencies', () => {
    test('should detect multiple nutrient deficiencies', () => {
      optimalWater.nitrate = 2;
      optimalWater.phosphorus = 1;
      optimalWater.iron = 0.5;
      
      const result = plant.grow(optimalWater, true);
      
      expect(result.deficiencies.length).toBeGreaterThanOrEqual(3);
      expect(result.deficiencies.map(d => d.nutrient)).toContain('nitrogen');
      expect(result.deficiencies.map(d => d.nutrient)).toContain('phosphorus');
      expect(result.deficiencies.map(d => d.nutrient)).toContain('iron');
    });

    test('should compound growth penalties with multiple deficiencies', () => {
      optimalWater.nitrate = 1;
      optimalWater.phosphorus = 0.5;
      optimalWater.potassium = 10;
      
      const result = plant.grow(optimalWater, true);
      
      // Multiple penalties should significantly reduce growth
      expect(result.growthRate).toBeLessThan(0.5);
    });

    test('should reduce health more with multiple deficiencies', () => {
      optimalWater.nitrate = 1;
      optimalWater.phosphorus = 0.5;
      optimalWater.iron = 0.3;
      
      for (let i = 0; i < 3; i++) {
        plant.grow(optimalWater, true);
      }
      
      // Health should be noticeably reduced, but may not be below 50 in just 3 weeks
      expect(plant.health).toBeLessThan(90);
    });
  });

  describe('Harvesting', () => {
    test('should not harvest immature plants', () => {
      const result = plant.harvest();
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('Plant not ready for harvest');
      expect(result.value).toBe(0);
    });

    test('should harvest mature healthy plants at full value', () => {
      // Grow to maturity with optimal conditions (28 days)
      for (let i = 0; i < 28; i++) {
        plant.grow(optimalWater, true);
      }
      
      const result = plant.harvest();
      
      expect(result.success).toBe(true);
      expect(result.value).toBe(2.0); // Full valuePerHead
      expect(result.quality).toBe('excellent');
      expect(result.health).toBe(100);
    });

    test('should reduce harvest value for unhealthy plants', () => {
      // Grow with deficiencies (28 days)
      optimalWater.nitrate = 1;
      optimalWater.phosphorus = 0.5;
      
      for (let i = 0; i < 28; i++) {
        plant.grow(optimalWater, true);
      }
      
      const result = plant.harvest();
      
      expect(result.success).toBe(true);
      expect(result.value).toBeLessThan(2.0);
      expect(result.quality).not.toBe('excellent');
    });

    test('should categorize harvest quality based on health', () => {
      // Test different health levels
      plant.health = 85;
      plant.daysGrown = 28; // 4 weeks * 7 days
      plant.weeksGrown = 4;
      let result = plant.harvest();
      expect(result.quality).toBe('excellent');

      plant.health = 70;
      result = plant.harvest();
      expect(result.quality).toBe('good');

      plant.health = 50;
      result = plant.harvest();
      expect(result.quality).toBe('fair');

      plant.health = 30;
      result = plant.harvest();
      expect(result.quality).toBe('poor');
    });
  });

  describe('Growth rate calculations', () => {
    test('should never have negative growth rate', () => {
      // Terrible conditions
      optimalWater.nitrate = 0;
      optimalWater.phosphorus = 0;
      optimalWater.potassium = 0;
      optimalWater.pH = 5.0;
      
      const result = plant.grow(optimalWater, true);
      
      expect(result.growthRate).toBeGreaterThanOrEqual(0);
    });

    test('should progress days even with zero growth', () => {
      optimalWater.nitrate = 0;
      
      const result = plant.grow(optimalWater, true);
      
      expect(plant.daysGrown).toBe(1);
      expect(result.growthRate).toBeGreaterThanOrEqual(0);
    });
  });
});
