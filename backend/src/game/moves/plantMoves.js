// All moves related to plant management in the aquaponics system
// Handles planting, harvesting, plant care, grow bed management

const { plantSpecies } = require('../data/plantSpecies');

const DEFAULT_MAX_PLANT_SLOTS = 4 * 9 + 2 * 4 * 11;

const plantMoves = {
  // Plant a seed in a grow bed
  // Parameters: plantType (e.g. 'ParrisIslandRomaine'), bedLocation
  plantSeed: ({ G, ctx }, plantType, bedLocation, slotCount) => {
    const parsedSlotCount = Number(slotCount);
    const maxPlantSlots = Number.isInteger(parsedSlotCount) && parsedSlotCount > 0
      ? parsedSlotCount
      : (G.maxPlantSlots || DEFAULT_MAX_PLANT_SLOTS);
    G.maxPlantSlots = maxPlantSlots;

    const species = plantSpecies[plantType];
    if (!species) {
      console.log(`[plantSeed] Unknown species: ${plantType}`);
      G.lastAction = { type: 'plantSeed', success: false, reason: 'unknown_species' };
      return;
    }

    
    if (G.plants.length >= maxPlantSlots) {
      console.log(`[plantSeed] Reached maximum capacity of ${maxPlantSlots} plants.`);
      G.lastAction = { type: 'plantSeed', success: false, reason: 'capacity_reached' };
      return;
    }

    const cost = species.seedCost || 0;
    if (G.money < cost) {
      console.log(`[plantSeed] Not enough money. Need $${cost}, have $${G.money}`);
      G.lastAction = { type: 'plantSeed', success: false, reason: 'insufficient_funds' };
      return;
    }

    G.money -= cost;

    // Total growth time in days (weeks * 7)
    
    const occupiedSlots = new Set(G.plants.map(p => p.slotIndex).filter(i => i !== undefined));
    let slotIndex = 0;
    while (occupiedSlots.has(slotIndex) && slotIndex < maxPlantSlots) {
        slotIndex++;
    }

    if (slotIndex >= maxPlantSlots) {
      console.log(`[plantSeed] No free slot index available within ${maxPlantSlots} slots.`);
      G.lastAction = { type: 'plantSeed', success: false, reason: 'capacity_reached' };
      return;
    }

    const totalGrowthDays = (species.totalGrowthTime || 6) * 7;

    G.plants.push({
      id: `plant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: plantType,
      category: species.category,
      renderAsset: species.renderAsset,
      renderScale: species.renderScale,
      slotIndex,
      location: bedLocation,
      age: 0,                   // days since planting
      growthDays: totalGrowthDays, // days to reach maturity
      growthStage: 'seedling',  // seedling -> growing -> mature
      health: 10,
      plantedAt: G.gameTime,
      harvestWeight: species.harvestWeight,
      valuePerHead: species.valuePerHead,
    });

    console.log(`[plantSeed] Planted ${plantType} in ${bedLocation} for $${cost}. Total plants: ${G.plants.length}`);
    G.lastAction = {
      type: 'plantSeed',
      plantType,
      location: bedLocation,
      cost,
      success: true,
    };
  },

  // Harvest mature plants
  // Parameters: plantId
  harvestPlant: ({ G, ctx }, plantId) => {
    const index = G.plants.findIndex(p => p.id === plantId);
    if (index === -1) {
      G.lastAction = { type: 'harvestPlant', success: false, reason: 'not_found' };
      return;
    }

    const plant = G.plants[index];
    if (plant.growthStage !== 'mature') {
      console.log(`[harvestPlant] ${plant.type} is not mature yet (stage: ${plant.growthStage})`);
      G.lastAction = { type: 'harvestPlant', success: false, reason: 'not_mature' };
      return;
    }

    const earnings = plant.valuePerHead || 2.00;
    G.money += earnings;
    G.plants.splice(index, 1);

    console.log(`[harvestPlant] Harvested ${plant.type} for $${earnings}. Plants remaining: ${G.plants.length}`);
    G.lastAction = {
      type: 'harvestPlant',
      plantType: plant.type,
      earnings,
      success: true,
    };
  },

  // Care for plants (pruning, disease treatment)
  // Parameters: plantId, careType
  carePlant: ({ G, ctx }, plantId, careType) => {
    console.log(`Player ${ctx.currentPlayer} performed ${careType} on plant ${plantId}`);
    // TODO: Improve plant health, cost energy/money
  }
};

module.exports = plantMoves;