// All moves related to fish management in the aquaponics system
// Handles feeding, adding new fish, monitoring fish health, etc.

const { fishSpecies } = require('../data/fishSpecies');

const fishMoves = {
  // Feed fish in the system
  // Parameters: fishId (specific fish or 'all'), foodAmount
  feedFish: ({ G, ctx }, fishId, foodAmount) => {
    console.log(`Player ${ctx.currentPlayer} fed fish ${fishId} with ${foodAmount} food`);
    // TODO: Find fish by ID, update health, consume food budget, affect water quality
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