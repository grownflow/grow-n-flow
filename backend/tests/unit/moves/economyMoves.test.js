const economyMoves = require('../../../src/game/moves/economyMoves');
const { Fish } = require('../../../src/game/models/Fish');
const { Plant } = require('../../../src/game/models/Plant');
const { AquaponicsSystem } = require('../../../src/game/models/AquaponicsSystem');

describe('Economy Moves', () => {
  let G, ctx;

  beforeEach(() => {
    G = {
      fish: [],
      plants: [],
      aquaponicsSystem: null,
      gameTime: 0,
      money: 500,
      lastAction: null,
      equipment: {},
      fishFood: 0
    };
    ctx = { currentPlayer: '0', turn: 1 };
  });

  describe('buyEquipment', () => {
    test('should return error for unknown equipment type', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'unknownEquipment');
      
      expect(result.error).toBe('Unknown equipment: unknownEquipment');
      expect(result.money).toBe(500); // Money should not be deducted
    });

    test('should return error for insufficient funds', () => {
      G.money = 30;
      const result = economyMoves.buyEquipment(G, ctx, 'phMeter');
      
      expect(result.error).toContain('Insufficient funds');
      expect(result.money).toBe(30);
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('insufficient_funds');
    });

    test('should successfully buy equipment with sufficient funds', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'phMeter');
      
      expect(result.error).toBeUndefined();
      expect(result.money).toBe(450); // 500 - 50
      expect(result.equipment.phMeter).toBe(1);
      expect(result.lastAction.type).toBe('buyEquipment');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.equipmentType).toBe('phMeter');
      expect(result.lastAction.cost).toBe(50);
    });

    test('should buy multiple quantities of equipment', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'thermometer', 3);
      
      expect(result.money).toBe(410); // 500 - (30 * 3)
      expect(result.equipment.thermometer).toBe(3);
      expect(result.lastAction.quantity).toBe(3);
      expect(result.lastAction.cost).toBe(90);
    });

    test('should accumulate equipment in inventory', () => {
      let result = economyMoves.buyEquipment(G, ctx, 'phMeter');
      result = economyMoves.buyEquipment(result, ctx, 'phMeter');
      
      expect(result.equipment.phMeter).toBe(2);
      expect(result.money).toBe(400); // 500 - 50 - 50
    });

    test('should apply waterPump benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'waterPump');
      
      expect(result.waterSystem).toBeDefined();
      expect(result.waterSystem.circulationEfficiency).toBeCloseTo(1.1, 5);
      expect(result.lastAction.benefits).toContain('Improved water circulation');
    });

    test('should apply airPump benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'airPump');
      
      expect(result.waterSystem).toBeDefined();
      expect(result.waterSystem.oxygenLevel).toBeCloseTo(8.5, 5);
      expect(result.lastAction.benefits).toContain('Increased oxygen levels');
    });

    test('should apply biofilter benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'biofilter');
      
      expect(result.aquaponicsSystem).toBeDefined();
      expect(result.aquaponicsSystem).toBeInstanceOf(AquaponicsSystem);
      expect(result.aquaponicsSystem.biofilterEfficiency).toBeCloseTo(0.85, 5);
      expect(result.lastAction.benefits).toContain('Improved nitrogen cycle efficiency');
    });

    test('should apply growLight benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'growLight');
      
      expect(result.systemModifiers).toBeDefined();
      expect(result.systemModifiers.plantGrowthRate).toBeCloseTo(1.1, 5);
      expect(result.lastAction.benefits).toContain('Improved plant growth rate');
    });

    test('should apply growBed benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'growBed', 2);
      
      expect(result.maxPlants).toBe(20); // 10 + (5 * 2)
      expect(result.lastAction.benefits).toContain('Added 10 plant growing capacity');
    });

    test('should apply fishTank benefits', () => {
      const result = economyMoves.buyEquipment(G, ctx, 'fishTank', 2);
      
      expect(result.maxFish).toBe(40); // 20 + (10 * 2)
      expect(result.lastAction.benefits).toContain('Added 20 fish capacity');
    });

    test('should initialize equipment inventory if it does not exist', () => {
      delete G.equipment;
      const result = economyMoves.buyEquipment(G, ctx, 'phMeter');
      
      expect(result.equipment).toBeDefined();
      expect(result.equipment.phMeter).toBe(1);
    });
  });

  describe('sellFish', () => {
    test('should return error when fish index is not found', () => {
      const result = economyMoves.sellFish(G, ctx, 0);
      
      expect(result.error).toContain('Fish at index 0 not found');
      expect(result.fish).toHaveLength(0);
    });

    test('should return error when fish is not harvestable', () => {
      const fish = new Fish('tilapia', 5);
      fish.size = 100; // Below harvest weight
      G.fish = [fish];
      
      const result = economyMoves.sellFish(G, ctx, 0);
      
      expect(result.error).toContain('Fish not ready for harvest');
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('not_harvestable');
      expect(result.fish).toHaveLength(1); // Fish should not be removed
    });

    test('should successfully sell specific harvestable fish', () => {
      const fish = new Fish('tilapia', 5);
      fish.size = 800; // Above harvest weight (800g >= 800g * 0.8)
      fish.health = 10;
      G.fish = [fish];
      
      const result = economyMoves.sellFish(G, ctx, 0);
      
      expect(result.error).toBeUndefined();
      expect(result.fish).toHaveLength(0); // Fish should be removed
      expect(result.money).toBeGreaterThan(500); // Money should increase
      expect(result.lastAction.type).toBe('sellFish');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.fishSold).toHaveLength(1);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });

    test('should return error when no harvestable fish exist (sell all)', () => {
      const fish = new Fish('tilapia', 5);
      fish.size = 100; // Below harvest weight
      G.fish = [fish];
      
      const result = economyMoves.sellFish(G, ctx);
      
      expect(result.error).toBe('No fish ready for harvest');
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('no_harvestable_fish');
      expect(result.fish).toHaveLength(1); // Fish should not be removed
    });

    test('should sell all harvestable fish when no index specified', () => {
      const fish1 = new Fish('tilapia', 5);
      fish1.size = 800; // Harvestable
      fish1.health = 10;
      
      const fish2 = new Fish('barramundi', 3);
      fish2.size = 1200; // Harvestable
      fish2.health = 10;
      
      const fish3 = new Fish('tilapia', 2);
      fish3.size = 100; // Not harvestable
      
      G.fish = [fish1, fish2, fish3];
      
      const result = economyMoves.sellFish(G, ctx);
      
      expect(result.error).toBeUndefined();
      expect(result.fish).toHaveLength(1); // Only non-harvestable fish remains
      expect(result.fish[0]).toBe(fish3);
      expect(result.money).toBeGreaterThan(500);
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.fishSold.length).toBeGreaterThanOrEqual(2);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });

    test('should add correct money amount when selling fish', () => {
      const fish = new Fish('tilapia', 5);
      fish.size = 1000; // 1kg = 2.20462 lbs
      fish.health = 10;
      G.fish = [fish];
      G.money = 100;
      
      const initialMoney = G.money;
      const result = economyMoves.sellFish(G, ctx, 0);
      
      expect(result.money).toBeGreaterThan(initialMoney);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });
  });

  describe('sellPlants', () => {
    test('should return error when plant ID is not found', () => {
      const result = economyMoves.sellPlants(G, ctx, 'nonexistent-id');
      
      expect(result.error).toBe('Plant with ID nonexistent-id not found');
      expect(result.plants).toHaveLength(0);
    });

    test('should return error when plant is not harvestable', () => {
      const plant = new Plant('plant-1', 'ParrisIslandRomaine');
      plant.daysGrown = 14; // Below growth period (28 days needed)
      plant.weeksGrown = 2;
      G.plants = [plant];
      
      const result = economyMoves.sellPlants(G, ctx, 'plant-1');
      
      expect(result.error).toBe('Plant not ready for harvest');
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('Plant not ready for harvest');
      expect(result.plants).toHaveLength(1); // Plant should not be removed
    });

    test('should successfully sell specific harvestable plant', () => {
      const plant = new Plant('plant-1', 'ParrisIslandRomaine');
      plant.daysGrown = 70; // Above growth period (harvestable)
      plant.weeksGrown = 10;
      G.plants = [plant];
      
      const result = economyMoves.sellPlants(G, ctx, 'plant-1');
      
      expect(result.error).toBeUndefined();
      expect(result.plants).toHaveLength(0); // Plant should be removed
      expect(result.money).toBeGreaterThan(500); // Money should increase
      expect(result.lastAction.type).toBe('sellPlants');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.plantsSold).toHaveLength(1);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });

    test('should return error when no harvestable plants exist (sell all)', () => {
      const plant = new Plant('plant-1', 'ParrisIslandRomaine');
      plant.daysGrown = 14; // Not harvestable
      plant.weeksGrown = 2;
      G.plants = [plant];
      
      const result = economyMoves.sellPlants(G, ctx);
      
      expect(result.error).toBe('No plants ready for harvest');
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('no_harvestable_plants');
      expect(result.plants).toHaveLength(1); // Plant should not be removed
    });

    test('should sell all harvestable plants when no ID specified', () => {
      const plant1 = new Plant('plant-1', 'ParrisIslandRomaine');
      plant1.daysGrown = 70; // Harvestable (>28 days for 4-week crop)
      plant1.weeksGrown = 10;
      
      const plant2 = new Plant('plant-2', 'ParrisIslandRomaine');
      plant2.daysGrown = 84; // Harvestable
      plant2.weeksGrown = 12;
      
      const plant3 = new Plant('plant-3', 'ParrisIslandRomaine');
      plant3.daysGrown = 21; // Not harvestable (<28 days)
      plant3.weeksGrown = 3;
      
      G.plants = [plant1, plant2, plant3];
      
      const result = economyMoves.sellPlants(G, ctx);
      
      expect(result.error).toBeUndefined();
      expect(result.plants).toHaveLength(1); // Only non-harvestable plant remains
      expect(result.plants[0].id).toBe('plant-3');
      expect(result.money).toBeGreaterThan(500);
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.plantsSold.length).toBeGreaterThanOrEqual(2);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });

    test('should add correct money amount when selling plants', () => {
      const plant = new Plant('plant-1', 'ParrisIslandRomaine');
      plant.daysGrown = 70; // Harvestable
      plant.weeksGrown = 10;
      G.plants = [plant];
      G.money = 100;
      
      const initialMoney = G.money;
      const result = economyMoves.sellPlants(G, ctx, 'plant-1');
      
      expect(result.money).toBeGreaterThan(initialMoney);
      expect(result.lastAction.totalValue).toBeGreaterThan(0);
    });
  });

  describe('buyFishFood', () => {
    test('should return error for insufficient funds', () => {
      G.money = 10;
      const result = economyMoves.buyFishFood(G, ctx, 1);
      
      expect(result.error).toContain('Insufficient funds');
      expect(result.money).toBe(10);
      expect(result.lastAction.success).toBe(false);
      expect(result.lastAction.reason).toBe('insufficient_funds');
    });

    test('should successfully buy fish food with sufficient funds', () => {
      const result = economyMoves.buyFishFood(G, ctx, 1);
      
      expect(result.error).toBeUndefined();
      expect(result.money).toBe(480); // 500 - 20
      expect(result.fishFood).toBe(10); // 1 purchase = 10 units
      expect(result.lastAction.type).toBe('buyFishFood');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.quantity).toBe(10);
      expect(result.lastAction.cost).toBe(20);
    });

    test('should buy multiple quantities of fish food', () => {
      const result = economyMoves.buyFishFood(G, ctx, 3);
      
      expect(result.money).toBe(440); // 500 - (20 * 3)
      expect(result.fishFood).toBe(30); // 3 purchases = 30 units
      expect(result.lastAction.quantity).toBe(30);
      expect(result.lastAction.cost).toBe(60);
    });

    test('should accumulate fish food in inventory', () => {
      let result = economyMoves.buyFishFood(G, ctx, 1);
      result = economyMoves.buyFishFood(result, ctx, 2);
      
      expect(result.fishFood).toBe(30); // 10 + 20
      expect(result.money).toBe(440); // 500 - 20 - 40
    });

    test('should initialize fishFood inventory if it does not exist', () => {
      delete G.fishFood;
      const result = economyMoves.buyFishFood(G, ctx, 1);
      
      expect(result.fishFood).toBe(10);
    });
  });

  describe('skipTurn', () => {
    test('should advance game time', () => {
      const result = economyMoves.skipTurn(G, ctx);
      
      expect(result.gameTime).toBe(1);
      expect(result.lastAction.type).toBe('skipTurn');
      expect(result.lastAction.timeAdvanced).toBe(1);
      expect(result.lastAction.success).toBe(true);
    });

    test('should add passive income', () => {
      G.money = 100;
      const result = economyMoves.skipTurn(G, ctx);
      
      expect(result.money).toBe(105); // 100 + 5
      expect(result.lastAction.passiveIncome).toBe(5);
    });

    test('should process aquaponics system if it exists', () => {
      const system = new AquaponicsSystem();
      const processTurnSpy = jest.spyOn(system, 'processTurn');
      G.aquaponicsSystem = system;
      G.fish = [new Fish('tilapia', 5)];
      
      const result = economyMoves.skipTurn(G, ctx);
      
      expect(processTurnSpy).toHaveBeenCalledWith(G.fish);
      expect(result.gameTime).toBe(1);
      expect(result.money).toBe(505);
    });

    test('should work without aquaponics system', () => {
      G.aquaponicsSystem = null;
      const result = economyMoves.skipTurn(G, ctx);
      
      expect(result.gameTime).toBe(1);
      expect(result.money).toBe(505);
      expect(result.lastAction.success).toBe(true);
    });
  });

  describe('getMarketPrices', () => {
    test('should return market prices structure', () => {
      const result = economyMoves.getMarketPrices(G, ctx);
      
      expect(result.lastAction.type).toBe('getMarketPrices');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.prices).toBeDefined();
      expect(result.lastAction.prices.fish).toBeDefined();
      expect(result.lastAction.prices.plants).toBeDefined();
    });

    test('should include fish prices', () => {
      const result = economyMoves.getMarketPrices(G, ctx);
      
      expect(Object.keys(result.lastAction.prices.fish).length).toBeGreaterThan(0);
    });

    test('should include plant prices', () => {
      const result = economyMoves.getMarketPrices(G, ctx);
      
      expect(Object.keys(result.lastAction.prices.plants).length).toBeGreaterThan(0);
    });
  });

  describe('getEquipmentCatalog', () => {
    test('should return equipment catalog', () => {
      const result = economyMoves.getEquipmentCatalog(G, ctx);
      
      expect(result.lastAction.type).toBe('getEquipmentCatalog');
      expect(result.lastAction.success).toBe(true);
      expect(result.lastAction.equipment).toBeDefined();
      expect(result.lastAction.equipment.phMeter).toBeDefined();
      expect(result.lastAction.equipment.thermometer).toBeDefined();
      expect(result.lastAction.equipment.waterPump).toBeDefined();
    });

    test('should include equipment with cost and description', () => {
      const result = economyMoves.getEquipmentCatalog(G, ctx);
      
      expect(result.lastAction.equipment.phMeter.cost).toBe(50);
      expect(result.lastAction.equipment.phMeter.description).toBeDefined();
      expect(result.lastAction.equipment.waterPump.cost).toBe(120);
      expect(result.lastAction.equipment.growLight.cost).toBe(100);
    });
  });
});

