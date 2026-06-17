// All moves related to plant management in the aquaponics system
// Handles planting, harvesting, plant care, grow bed management

const { plantSpecies } = require('../data/plantSpecies');

const DEFAULT_MAX_PLANT_SLOTS = 4 * 9 + 4 * 15 + 4 * 11; // bed1:36 + bed2:60 + bed3:44 = 140

function resolveMaxPlantSlots(G, slotCount) {
  const parsedSlotCount = Number(slotCount);
  const maxPlantSlots = Number.isInteger(parsedSlotCount) && parsedSlotCount > 0
    ? parsedSlotCount
    : (G.maxPlantSlots || DEFAULT_MAX_PLANT_SLOTS);
  G.maxPlantSlots = maxPlantSlots;
  return maxPlantSlots;
}

function buildOccupiedSlotSet(plants) {
  const occupied = new Set();
  for (const plant of plants || []) {
    if (plant && plant.slotIndex !== undefined) occupied.add(plant.slotIndex);
  }
  return occupied;
}

const plantMoves = {
  // Plant a seed in a grow bed
  // Parameters: plantType (e.g. 'ParrisIslandRomaine'), bedLocation
  plantSeed: ({ G, ctx }, plantType, bedLocation, slotCount) => {
    const maxPlantSlots = resolveMaxPlantSlots(G, slotCount);

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

    const occupiedSlots = buildOccupiedSlotSet(G.plants);
    let slotIndex = 0;
    while (occupiedSlots.has(slotIndex) && slotIndex < maxPlantSlots) {
        slotIndex++;
    }

    if (slotIndex >= maxPlantSlots) {
      console.log(`[plantSeed] No free slot index available within ${maxPlantSlots} slots.`);
      G.lastAction = { type: 'plantSeed', success: false, reason: 'capacity_reached' };
      return;
    }

    const totalGrowthDays = species.totalGrowthTime || 6;

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

  // Plant multiple seeds in one move (used by the UI's "Buy All")
  // Parameters: plantType, quantity, slotCount
  plantSeedsBulk: ({ G, ctx }, plantType, quantity, slotCount) => {
    const maxPlantSlots = resolveMaxPlantSlots(G, slotCount);

    const species = plantSpecies[plantType];
    if (!species) {
      console.log(`[plantSeedsBulk] Unknown species: ${plantType}`);
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'unknown_species' };
      return;
    }

    const requested = Number(quantity);
    const requestedCount = Number.isFinite(requested) ? Math.floor(requested) : 0;
    if (requestedCount <= 0) {
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'invalid_quantity' };
      return;
    }

    const openSlots = Math.max(0, maxPlantSlots - (G.plants?.length || 0));
    if (openSlots <= 0) {
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'capacity_reached' };
      return;
    }

    const costPerSeed = Number(species.seedCost || 0);
    const affordableCount = costPerSeed > 0
      ? Math.floor((G.money || 0) / costPerSeed)
      : requestedCount;

    const plantCount = Math.max(0, Math.min(requestedCount, openSlots, affordableCount));
    if (plantCount <= 0) {
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'insufficient_funds' };
      return;
    }

    const t0 = Date.now();
    const occupiedSlots = buildOccupiedSlotSet(G.plants);
    const freeSlotIndices = [];
    for (let i = 0; i < maxPlantSlots && freeSlotIndices.length < plantCount; i++) {
      if (!occupiedSlots.has(i)) freeSlotIndices.push(i);
    }

    if (freeSlotIndices.length !== plantCount) {
      // Should be rare, but keep it safe.
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'capacity_reached' };
      return;
    }

    const totalCost = costPerSeed * plantCount;
    if ((G.money || 0) < totalCost) {
      G.lastAction = { type: 'plantSeedsBulk', success: false, reason: 'insufficient_funds' };
      return;
    }
    G.money -= totalCost;

    const totalGrowthDays = species.totalGrowthTime || 6;
    const now = Date.now();
    for (let i = 0; i < freeSlotIndices.length; i++) {
      const slotIndex = freeSlotIndices[i];
      G.plants.push({
        id: `plant_${now}_${slotIndex}_${Math.random().toString(36).slice(2, 7)}`,
        type: plantType,
        category: species.category,
        renderAsset: species.renderAsset,
        renderScale: species.renderScale,
        slotIndex,
        location: `slot_${slotIndex}`,
        age: 0,
        growthDays: totalGrowthDays,
        growthStage: 'seedling',
        health: 10,
        plantedAt: G.gameTime,
        harvestWeight: species.harvestWeight,
        valuePerHead: species.valuePerHead,
      });
    }

    const slotSearchMs = Date.now() - t0;
    console.log(`[plantSeedsBulk] Planted ${plantCount}x ${plantType} for $${totalCost}. slotSearchMs=${slotSearchMs}. Total plants: ${G.plants.length}`);
    G.lastAction = {
      type: 'plantSeedsBulk',
      plantType,
      requestedCount,
      plantedCount: plantCount,
      costPerSeed,
      totalCost,
      slotSearchMs,
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

    if (!G.inventory) G.inventory = { produce: {} };
    if (!G.inventory.produce) G.inventory.produce = {};

    const unitPrice = Number(plant.valuePerHead ?? 2.0);
    const key = String(plant.type || 'Unknown');
    const existing = G.inventory.produce[key];
    const nextCount = (existing?.count || 0) + 1;
    G.inventory.produce[key] = { count: nextCount, unitPrice };

    G.plants.splice(index, 1);

    console.log(`[harvestPlant] Harvested ${plant.type} into inventory. Plants remaining: ${G.plants.length}`);
    G.lastAction = {
      type: 'harvestPlant',
      plantType: plant.type,
      inventoryDelta: { produceType: key, quantity: 1, unitPrice },
      success: true,
    };
  },

  // Harvest all mature plants into inventory (single action)
  harvestAllMaturePlants: ({ G, ctx }) => {
    if (!Array.isArray(G.plants) || G.plants.length === 0) {
      G.lastAction = { type: 'harvestAllMaturePlants', success: false, reason: 'no_plants' };
      return;
    }

    if (!G.inventory) G.inventory = { produce: {} };
    if (!G.inventory.produce) G.inventory.produce = {};

    const harvestedByType = {};
    const remaining = [];

    for (const plant of G.plants) {
      if (plant?.growthStage === 'mature') {
        const key = String(plant.type || 'Unknown');
        const unitPrice = Number(plant.valuePerHead ?? 2.0);
        const existing = G.inventory.produce[key];
        const nextCount = (existing?.count || 0) + 1;
        G.inventory.produce[key] = { count: nextCount, unitPrice };

        harvestedByType[key] = (harvestedByType[key] || 0) + 1;
      } else {
        remaining.push(plant);
      }
    }

    const harvestedCount = Object.values(harvestedByType).reduce((a, b) => a + b, 0);

    if (harvestedCount === 0) {
      G.lastAction = { type: 'harvestAllMaturePlants', success: false, reason: 'none_mature' };
      return;
    }

    // Bulk harvest bonus: 15+ plants in one harvest earns a 15% market premium.
    const BULK_THRESHOLD = 15;
    const BULK_BONUS_MULT = 1.15;
    const bulkBonus = harvestedCount >= BULK_THRESHOLD;
    if (bulkBonus) {
      for (const key of Object.keys(harvestedByType)) {
        const entry = G.inventory.produce[key];
        if (entry) {
          entry.unitPrice = Math.round(entry.unitPrice * BULK_BONUS_MULT * 100) / 100;
        }
      }
    }

    G.plants = remaining;
    G.lastAction = {
      type: 'harvestAllMaturePlants',
      success: true,
      harvestedCount,
      harvestedByType,
      bulkBonus,
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