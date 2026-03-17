// All moves related to economic aspects of the game
// Handles buying/selling, equipment purchases, market interactions

const economyMoves = {
  // Buy equipment or upgrades
  // Parameters: equipmentType, quantity
  buyEquipment: ({ G, ctx }, equipmentType, quantity = 1) => {
    console.log(`Player ${ctx.currentPlayer} bought ${quantity} ${equipmentType}`);
    // TODO: Deduct money, add equipment to inventory, improve system efficiency
  },

  sellFish: ({ G, ctx }, fishIdentifier) => {
    let indicesToSell = [];

    const getMarketValue = (fish) => {
      const weightInPounds = (fish.weight / 1000) * 2.20462;
      const mv = fish.marketValue || 5; 
      const healthMult = (fish.health || 10) / 10;
      return weightInPounds * mv * healthMult;
    };

    const isHarvestable = (fish) => {
      const hw = fish.harvestWeight || 800;
      return fish.weight >= hw * 0.8;
    };

    if (fishIdentifier !== undefined) {
      let index = G.fish.findIndex(f => f.id === fishIdentifier);

      if (index === -1 || !G.fish[index]) {
        console.log("Fish not found to sell!");
        return;
      }
      
      const fish = G.fish[index];
      if (!isHarvestable(fish)) {
        G.lastAction = { type: 'sellFish', success: false, reason: 'not_harvestable' };
        return;
      }
      indicesToSell.push(index);
    } else {
      // Sell all harvestable
      G.fish.forEach((f, i) => {
        if (isHarvestable(f)) indicesToSell.push(i);
      });
      if (indicesToSell.length === 0) {
        G.lastAction = { type: 'sellFish', success: false, reason: 'no_harvestable_fish' };
        return;
      }
    }

    let totalValue = 0;
    const fishSold = [];
    
    // Remove from back to front to not mess up indices
    indicesToSell.sort((a, b) => b - a).forEach(index => {
      const fish = G.fish[index];
      totalValue += getMarketValue(fish);
      fishSold.push(fish);
      G.fish.splice(index, 1); // remove from array
    });

    G.money = (G.money || 0) + totalValue;
    G.lastAction = {
      type: 'sellFish',
      success: true,
      fishSold,
      totalValue
    };
  },

  // Skip turn to advance time and save energy
  skipTurn: ({ G, ctx }) => {
    console.log(`Player ${ctx.currentPlayer} skipped turn - time advances`);
    G.gameTime += 1;
    // TODO: Run background simulations, regenerate energy
  }
};

module.exports = economyMoves;
