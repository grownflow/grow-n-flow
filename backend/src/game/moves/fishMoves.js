// All moves related to fish management in the aquaponics system
// Handles feeding, adding new fish, monitoring fish health, etc.

const fishMoves = {
  // Feed fish in the system
  // Parameters: fishId (specific fish or 'all'), foodAmount
  feedFish: (G, ctx, fishId, foodAmount) => {
    console.log(`Player ${ctx.currentPlayer} fed fish ${fishId} with ${foodAmount} food`);
    // TODO: Find fish by ID, update health, consume food budget, affect water quality
  },

  // Add new fish to the system
  // Parameters: fishType (tilapia, catfish, etc.), quantity
  addFish: (G, ctx, fishType, quantity) => {
    console.log(`Player ${ctx.currentPlayer} added ${quantity} ${fishType} fish`);
    // TODO: Deduct money, add fish objects with individual properties to G.fish array
  },

  // Remove fish (death, harvest, etc.)
  // Parameters: fishId
  removeFish: (G, ctx, fishId) => {
    console.log(`Player ${ctx.currentPlayer} removed fish ${fishId}`);
    // TODO: Remove fish from array, handle death vs harvest differently
  }
};

module.exports = fishMoves;