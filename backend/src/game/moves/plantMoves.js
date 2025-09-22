// All moves related to plant management in the aquaponics system
// Handles planting, harvesting, plant care, grow bed management

const plantMoves = {
  // Plant a seed in a grow bed
  // Parameters: plantType, bedLocation
  plantSeed: (G, ctx, plantType, bedLocation) => {
    console.log(`Player ${ctx.currentPlayer} planted ${plantType} in bed ${bedLocation}`);
    // Add plant object to plants array (fix from previous += 1 error)
    G.plants.push({ 
      id: Date.now(), 
      type: plantType, 
      location: bedLocation, 
      growth: 0,
      plantedAt: G.gameTime,
      health: 100
    });
  },

  // Harvest mature plants
  // Parameters: plantId
  harvestPlant: (G, ctx, plantId) => {
    console.log(`Player ${ctx.currentPlayer} harvested plant ${plantId}`);
    // TODO: Find plant, check if mature, remove from array, add money
  },

  // Care for plants (pruning, disease treatment)
  // Parameters: plantId, careType
  carePlant: (G, ctx, plantId, careType) => {
    console.log(`Player ${ctx.currentPlayer} performed ${careType} on plant ${plantId}`);
    // TODO: Improve plant health, cost energy/money
  }
};

module.exports = plantMoves;