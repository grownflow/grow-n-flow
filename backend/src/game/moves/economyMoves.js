// All moves related to economic aspects of the game
// Handles buying/selling, equipment purchases, market interactions

const economyMoves = {
  // Buy equipment or upgrades
  // Parameters: equipmentType, quantity
  buyEquipment: (G, ctx, equipmentType, quantity = 1) => {
    console.log(`Player ${ctx.currentPlayer} bought ${quantity} ${equipmentType}`);
    // TODO: Deduct money, add equipment to inventory, improve system efficiency
  },

  // Sell harvested products
  // Parameters: productType, quantity
  sellProducts: (G, ctx, productType, quantity) => {
    console.log(`Player ${ctx.currentPlayer} sold ${quantity} ${productType}`);
    // TODO: Add money based on market prices and product quality
  },

  // Skip turn to advance time and save energy
  skipTurn: (G, ctx) => {
    console.log(`Player ${ctx.currentPlayer} skipped turn - time advances`);
    G.gameTime += 1;
    // TODO: Run background simulations, regenerate energy
  }
};

module.exports = economyMoves;