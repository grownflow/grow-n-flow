const { progressTurn } = require('./src/game/moves/systemMoves');
const G = {
  fish: [{ id: 'f1', type: 'tilapia', weight: 100, health: 2, age: 250, harvestTime: 210, growthRate: 2.8, ammoniaProductionRate: 0.1, foodConsumptionRate: 0.2 }],
  plants: [{ id: 'p1', type: 'ParrisIslandRomaine', age: 80, growthDays: 42, growthStage: 'mature', health: 2 }],
  aquaponicsSystem: {
    tank: {
      water: { ammonia: 3.5, nitrite: 2.5, nitrate: 0.5, pH: 7.8, dissolvedOxygen: 3.5, iron: 0.5 },
      biofilterEfficiency: 0.4,
      circulationEfficiency: 0.5,
      currentWaterLevel: 1000,
      capacity: 1000
    },
    light: { isOn: true }
  },
  gameTime: 0,
  billsAccrued: { electricity: 0, water: 0 }
};
progressTurn({ G, ctx: { currentPlayer: '0' } });
console.log(JSON.stringify(G.lastAction, null, 2));
