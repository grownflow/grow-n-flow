// All moves related to fish management in the aquaponics system
// Handles feeding, adding new fish, monitoring fish health, etc.

const { fishSpecies } = require('../data/fishSpecies');
const { randomPointInWaterVolume } = require('../data/renderBounds');

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function unwrapFeedFishArgs(arg1, arg2, arg3, arg4) {
  // Supports both:
  //  - boardgame.io signature: ({ G, ctx }, fishIdentifier, foodAmount)
  //  - legacy/unit-test style: (G, ctx, fishIdentifier, foodAmount)
  if (arg1 && typeof arg1 === 'object' && arg1.G && arg1.ctx) {
    return { G: arg1.G, ctx: arg1.ctx, fishIdentifier: arg2, foodAmount: arg3 };
  }
  return { G: arg1, ctx: arg2 || { currentPlayer: '0' }, fishIdentifier: arg3, foodAmount: arg4 };
}

function ensureTankAndWaterState(G) {
  if (!G.aquaponicsSystem) G.aquaponicsSystem = { tank: {}, growBeds: {}, light: { isOn: true } };
  if (!G.aquaponicsSystem.tank) G.aquaponicsSystem.tank = {};
  const tank = G.aquaponicsSystem.tank;
  tank.foodInTank = clampNumber(tank.foodInTank ?? 0, 0, 1e9);
  tank.sediment = clampNumber(tank.sediment ?? 0, 0, 1e12);
  if (!tank.water) tank.water = {};
  const water = tank.water;

  water.temperature = clampNumber(water.temperature ?? 25, -10, 60);
  water.ammonia = clampNumber(water.ammonia ?? 0, 0, 1000);
  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen ?? 8, 0, 20);

  return { tank, water };
}

const fishMoves = {
  // Feed fish in the system
  // Parameters: fishId (specific fish or 'all'), foodAmount
  feedFish: (arg1, arg2, arg3, arg4) => {
    const { G, ctx, fishIdentifier, foodAmount } = unwrapFeedFishArgs(arg1, arg2, arg3, arg4);

    if (!G) return G;
    if (!Array.isArray(G.fish)) G.fish = [];

    const player = ctx?.currentPlayer ?? '0';

    const desiredFood = Math.floor(Number(foodAmount) || 0);
    if (!Number.isFinite(desiredFood) || desiredFood <= 0) {
      const msg = `Invalid food amount: ${foodAmount}`;
      G.error = msg;
      G.lastAction = { type: 'feedFish', success: false, reason: 'invalid_food_amount', fishIdentifier, foodAmount };
      return G;
    }

    const availableFood = Math.floor(Number(G.fishFood) || 0);
    if (availableFood <= 0) {
      const msg = 'No fish food available';
      G.error = msg;
      G.lastAction = { type: 'feedFish', success: false, reason: 'no_fish_food', fishIdentifier, foodAmount: desiredFood, availableFood };
      return G;
    }

    const foodAmountUsed = Math.max(0, Math.min(availableFood, desiredFood));
    const partial = foodAmountUsed < desiredFood;

    const { tank, water } = ensureTankAndWaterState(G);

    // Warn (but still allow) feeding when water chemistry is elevated.
    // Hard-blocking caused fish to starve to death when players couldn't lower
    // ammonia fast enough — resulting in catastrophic simultaneous die-off.
    const waterWarning =
      Number(water.ammonia ?? 0) >= 1.0 || Number(water.nitrite ?? 0) >= 1.0
        ? 'High ammonia or nitrite detected — consider a partial water change before feeding.'
        : null;

    // "Feed fish" now means "add food into the tank".
    // Fish will actually eat from tank.foodInTank during progressTurn.
    const tankFoodBefore = Number(tank.foodInTank || 0);
    tank.foodInTank = clampNumber(tankFoodBefore + foodAmountUsed, 0, 1e9);
    G.fishFood = Math.max(0, availableFood - foodAmountUsed);

    console.log(`Player ${player} inserted ${foodAmountUsed}/${desiredFood} food into tank (now ${tank.foodInTank}).`);
    if (G.error) G.error = null;
    G.lastAction = {
      type: 'feedFish',
      success: true,
      fishIdentifier,
      foodAmountRequested: desiredFood,
      foodAmountUsed,
      availableFood,
      partial,
      inventoryFoodRemaining: G.fishFood,
      tankFoodBefore: Number(tankFoodBefore.toFixed(3)),
      tankFoodAfter: Number(Number(tank.foodInTank).toFixed(3)),
      ...(waterWarning ? { warning: waterWarning } : {}),
    };

    return G;
  },

  // Add new fish to the system
  // Parameters: fishType (tilapia, barramundi), quantity
  addFish: ({ G, ctx }, fishType, quantity) => {
    const species = fishSpecies[fishType];
    if (!species) {
      console.log(`[addFish] Unknown species: ${fishType}`);
      G.lastAction = { type: 'addFish', success: false, reason: 'unknown_species' };
      return;
    }

    const qty = Math.max(1, Math.floor(quantity || 1));
    const totalCost = species.fingerlingCost * qty;

    if (G.money < totalCost) {
      console.log(`[addFish] Not enough money. Need $${totalCost}, have $${G.money}`);
      G.lastAction = { type: 'addFish', success: false, reason: 'insufficient_funds' };
      return;
    }

    G.money -= totalCost;

    // Create individual fish objects
    for (let i = 0; i < qty; i++) {
      const renderPosition = randomPointInWaterVolume();
      
      G.fish.push({

        id: `fish_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: fishType,
        weight: 10,  // starting fingerling weight in grams
        health: 10,
        age: 0,      // days old
        harvestWeight: species.harvestWeight,
        harvestTime: species.harvestTime,
        growthRate: species.baseGrowthRate,
        ammoniaProductionRate: species.ammoniaProductionRate,
        foodConsumptionRate: species.foodConsumptionRate,
        marketValue: species.marketValue,
        renderAsset: species.renderAsset,
        renderScale: species.renderScale,
        renderPosition,
      });
    }

    console.log(`[addFish] Added ${qty} ${fishType} for $${totalCost}. Total fish: ${G.fish.length}`);
    G.lastAction = {
      type: 'addFish',
      fishType,
      quantity: qty,
      cost: totalCost,
      success: true,
    };
  },

  // Remove fish (death, harvest, etc.)
  // Parameters: fishId
  removeFish: ({ G, ctx }, fishId) => {
    const index = G.fish.findIndex(f => f.id === fishId);
    if (index === -1) {
      G.lastAction = { type: 'removeFish', success: false, reason: 'not_found' };
      return;
    }
    const removed = G.fish.splice(index, 1)[0];
    console.log(`[removeFish] Removed ${removed.type} (${removed.id})`);
    G.lastAction = { type: 'removeFish', fishId, fishType: removed.type, success: true };
  }
};

module.exports = fishMoves;