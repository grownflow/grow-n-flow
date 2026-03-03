// Bot strategy implementations
// Different playing styles for simulation testing

const { Bot } = require('./Bot');
const { fishSpecies } = require('../game/data/fishSpecies');
const { plantSpecies } = require('../game/data/plantSpecies');

/**
 * Conservative Strategy
 * - Buys only when safe money buffer exists
 * - Prefers low-cost items
 * - Sells quickly
 * - Repairs immediately
 */
class ConservativeBot extends Bot {
  constructor(config = {}) {
    super('conservative', {
      riskTolerance: 0.2,
      minMoneyBuffer: 200,
      ...config
    });
  }

  checkPurchases(G, ctx) {
    const availableMoney = G.money - this.config.minMoneyBuffer;
    
    // Only buy if we have safe buffer
    if (availableMoney < 50) return null;

    // Buy tilapia (cheaper fish) if we have space
    if (!G.fish || G.fish.length < 2) {
      const fingerlingCost = fishSpecies.tilapia.fingerlingCost;
      if (availableMoney >= fingerlingCost * 2) {
        return { moveName: 'buyFish', args: ['tilapia', 2] };
      }
    }

    // Buy plants conservatively
    if (!G.plants || G.plants.length < 5) {
      const seedCost = plantSpecies.ParrisIslandRomaine.seedCost;
      if (availableMoney >= seedCost * 3) {
        return { moveName: 'buyPlantSeeds', args: ['ParrisIslandRomaine', 'bed1', 3] };
      }
    }

    return null;
  }
}

/**
 * Aggressive Strategy
 * - Buys maximum fish and plants early
 * - Uses most available money
 * - Waits for optimal harvest timing
 * - Takes risks
 */
class AggressiveBot extends Bot {
  constructor(config = {}) {
    super('aggressive', {
      riskTolerance: 0.9,
      minMoneyBuffer: 50,
      ...config
    });
  }

  checkPurchases(G, ctx) {
    const availableMoney = G.money - this.config.minMoneyBuffer;
    
    if (availableMoney < 10) return null;

    // Buy barramundi (higher value fish) aggressively
    if (!G.fish || G.fish.length < 10) {
      const fingerlingCost = fishSpecies.barramundi.fingerlingCost;
      const canBuy = Math.floor(availableMoney / fingerlingCost);
      if (canBuy >= 3) {
        return { moveName: 'buyFish', args: ['barramundi', Math.min(canBuy, 5)] };
      }
    }

    // Buy lots of plants
    if (!G.plants || G.plants.length < 20) {
      const seedCost = plantSpecies.ParrisIslandRomaine.seedCost;
      const canBuy = Math.floor(availableMoney / seedCost);
      if (canBuy >= 5) {
        return { moveName: 'buyPlantSeeds', args: ['ParrisIslandRomaine', 'bed1', Math.min(canBuy, 10)] };
      }
    }

    // Buy equipment for better efficiency
    if (G.money >= 150 && (!G.equipment || !G.equipment.growLight)) {
      return { moveName: 'buyEquipment', args: ['growLight', 1] };
    }

    return null;
  }
}

/**
 * Balanced Strategy
 * - Mix of conservative and aggressive
 * - Diversifies fish species
 * - Maintains steady growth
 */
class BalancedBot extends Bot {
  constructor(config = {}) {
    super('balanced', {
      riskTolerance: 0.5,
      minMoneyBuffer: 100,
      ...config
    });
  }

  checkPurchases(G, ctx) {
    const availableMoney = G.money - this.config.minMoneyBuffer;
    
    if (availableMoney < 20) return null;

    const fishCount = G.fish ? G.fish.length : 0;
    const plantCount = G.plants ? G.plants.length : 0;

    // Balance fish and plants
    if (fishCount < 5) {
      // Alternate between tilapia and barramundi
      const fishType = fishCount % 2 === 0 ? 'tilapia' : 'barramundi';
      const fingerlingCost = fishSpecies[fishType].fingerlingCost;
      if (availableMoney >= fingerlingCost * 2) {
        return { moveName: 'buyFish', args: [fishType, 2] };
      }
    }

    if (plantCount < 10) {
      const seedCost = plantSpecies.ParrisIslandRomaine.seedCost;
      const canBuy = Math.min(5, Math.floor(availableMoney / seedCost));
      if (canBuy >= 2) {
        return { moveName: 'buyPlantSeeds', args: ['ParrisIslandRomaine', 'bed1', canBuy] };
      }
    }

    // Buy basic equipment when affordable
    if (availableMoney >= 120 && (!G.equipment || !G.equipment.waterPump)) {
      return { moveName: 'buyEquipment', args: ['waterPump', 1] };
    }

    return null;
  }
}

/**
 * Random Strategy
 * - Makes random valid moves
 * - Useful for chaos testing and edge case discovery
 */
class RandomBot extends Bot {
  constructor(config = {}) {
    super('random', {
      riskTolerance: Math.random(),
      minMoneyBuffer: 0,
      ...config
    });
  }

  checkPurchases(G, ctx) {
    const availableMoney = G.money;
    
    if (availableMoney < 10) return null;

    // Randomly choose what to buy
    const choices = [];

    // Add fish options
    if (availableMoney >= fishSpecies.tilapia.fingerlingCost * 2) {
      choices.push({ moveName: 'buyFish', args: ['tilapia', Math.floor(Math.random() * 3) + 1] });
    }
    if (availableMoney >= fishSpecies.barramundi.fingerlingCost) {
      choices.push({ moveName: 'buyFish', args: ['barramundi', Math.floor(Math.random() * 2) + 1] });
    }

    // Add plant options
    if (availableMoney >= plantSpecies.ParrisIslandRomaine.seedCost * 2) {
      choices.push({ 
        moveName: 'buyPlantSeeds', 
        args: ['ParrisIslandRomaine', 'bed1', Math.floor(Math.random() * 5) + 1] 
      });
    }

    // Add equipment options
    const equipmentTypes = ['waterPump', 'airPump', 'growLight', 'biofilter'];
    equipmentTypes.forEach(type => {
      const { equipment } = require('../game/data/equipment');
      if (availableMoney >= equipment[type].cost) {
        choices.push({ moveName: 'buyEquipment', args: [type, 1] });
      }
    });

    if (choices.length === 0) return null;

    // Return random choice
    return choices[Math.floor(Math.random() * choices.length)];
  }

  // Override harvest to sometimes wait longer
  checkHarvests(G, ctx) {
    // 70% chance to harvest when ready, 30% wait
    if (Math.random() > 0.3) {
      return super.checkHarvests(G, ctx);
    }
    return null;
  }
}

/**
 * Factory function to create bot by strategy name
 */
function createBot(strategyName, config = {}) {
  switch (strategyName.toLowerCase()) {
    case 'conservative':
      return new ConservativeBot(config);
    case 'aggressive':
      return new AggressiveBot(config);
    case 'balanced':
      return new BalancedBot(config);
    case 'random':
      return new RandomBot(config);
    default:
      throw new Error(`Unknown strategy: ${strategyName}`);
  }
}

module.exports = {
  ConservativeBot,
  AggressiveBot,
  BalancedBot,
  RandomBot,
  createBot
};
