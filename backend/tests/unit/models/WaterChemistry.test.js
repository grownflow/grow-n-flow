const { WaterChemistry } = require('../../../src/game/models/WaterChemistry');

describe('WaterChemistry Model', () => {
  let water;

  beforeEach(() => {
    water = new WaterChemistry();
  });

  describe('Initialization', () => {
    test('should initialize with correct nitrogen cycle values', () => {
      expect(water.ammonia).toBe(0);
      expect(water.nitrite).toBe(0);
      expect(water.nitrate).toBe(10);
    });

    test('should initialize with correct water parameters', () => {
      expect(water.pH).toBe(7.0);
      expect(water.temperature).toBe(22);
      expect(water.dissolvedOxygen).toBe(8.0);
    });

    test('should initialize with correct plant nutrients', () => {
      expect(water.phosphorus).toBe(5);
      expect(water.potassium).toBe(40);
      expect(water.calcium).toBe(60);
      expect(water.magnesium).toBe(20);
      expect(water.iron).toBe(2);
    });
  });

  describe('Nitrogen cycle', () => {
    test('should process ammonia through biofilter', () => {
      const ammoniaInput = 2.0;
      const plantAbsorption = 0.5;
      const biofilterEfficiency = 0.8;

      water.update(ammoniaInput, plantAbsorption, biofilterEfficiency);

      expect(water.ammonia).toBe(0); // Ammonia converted
      expect(water.nitrite).toBe(0); // Nitrite converted
      expect(water.nitrate).toBeGreaterThan(10); // Nitrate accumulated
    });

    test('should adjust pH based on ammonia and plant absorption', () => {
      const initialPH = water.pH;
      
      // High ammonia, low plant absorption should lower pH
      water.update(5.0, 0.5, 0.8);
      
      expect(water.pH).toBeLessThan(initialPH);
    });

    test('should clamp pH between 6.0 and 8.0', () => {
      // Try to push pH very low
      for (let i = 0; i < 100; i++) {
        water.update(10, 0, 0.8);
      }
      expect(water.pH).toBeGreaterThanOrEqual(6.0);

      // Reset and try to push pH very high
      water.pH = 7.0;
      for (let i = 0; i < 100; i++) {
        water.update(0, 10, 0.8);
      }
      expect(water.pH).toBeLessThanOrEqual(8.0);
    });
  });

  describe('getStatus', () => {
    test('should return all water parameters with proper formatting', () => {
      const status = water.getStatus();

      expect(status).toHaveProperty('ammonia');
      expect(status).toHaveProperty('nitrite');
      expect(status).toHaveProperty('nitrate');
      expect(status).toHaveProperty('pH');
      expect(status).toHaveProperty('temperature');
      expect(status).toHaveProperty('dissolvedOxygen');
      expect(status).toHaveProperty('phosphorus');
      expect(status).toHaveProperty('potassium');
      expect(status).toHaveProperty('calcium');
      expect(status).toHaveProperty('magnesium');
      expect(status).toHaveProperty('iron');
    });

    test('should format nitrogen cycle values to 2 decimal places', () => {
      water.ammonia = 1.23456;
      water.nitrite = 2.34567;
      water.nitrate = 3.45678;

      const status = water.getStatus();

      expect(status.ammonia).toBe(1.23);
      expect(status.nitrite).toBe(2.35);
      expect(status.nitrate).toBe(3.46);
    });

    test('should format plant nutrients to 1 decimal place', () => {
      water.phosphorus = 5.6789;
      water.potassium = 40.1234;
      water.calcium = 60.5678;
      water.magnesium = 20.9876;

      const status = water.getStatus();

      expect(status.phosphorus).toBe(5.7);
      expect(status.potassium).toBe(40.1);
      expect(status.calcium).toBe(60.6);
      expect(status.magnesium).toBe(21.0);
    });

    test('should format iron to 2 decimal places', () => {
      water.iron = 2.3456;

      const status = water.getStatus();

      expect(status.iron).toBe(2.35);
    });

    test('should format pH and temperature to 1 decimal place', () => {
      water.pH = 6.789;
      water.temperature = 22.345;
      water.dissolvedOxygen = 8.234;

      const status = water.getStatus();

      expect(status.pH).toBe(6.8);
      expect(status.temperature).toBe(22.3);
      expect(status.dissolvedOxygen).toBe(8.2);
    });
  });

  describe('Nutrient tracking for plant growth', () => {
    test('should have sufficient nutrients for initial plant growth', () => {
      const status = water.getStatus();

      // Check against ParrisIslandRomaine requirements
      expect(status.nitrate).toBeGreaterThanOrEqual(5); // N requirement
      expect(status.phosphorus).toBeGreaterThanOrEqual(3); // P requirement
      expect(status.potassium).toBeGreaterThanOrEqual(30); // K requirement
      expect(status.calcium).toBeGreaterThanOrEqual(50); // Ca requirement
      expect(status.magnesium).toBeGreaterThanOrEqual(15); // Mg requirement
      expect(status.iron).toBeGreaterThanOrEqual(1); // Fe requirement
    });

    test('should allow manual nutrient depletion', () => {
      // Simulate plant consumption
      water.nitrate -= 2;
      water.phosphorus -= 1;
      water.potassium -= 5;

      expect(water.nitrate).toBe(8);
      expect(water.phosphorus).toBe(4);
      expect(water.potassium).toBe(35);
    });

    test('should allow nutrient replenishment', () => {
      // Simulate adding supplements
      water.phosphorus += 5;
      water.iron += 1;

      expect(water.phosphorus).toBe(10);
      expect(water.iron).toBe(3);
    });
  });
});
