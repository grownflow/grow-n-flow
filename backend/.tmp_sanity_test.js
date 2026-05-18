const fishMoves = require('./src/game/moves/fishMoves');
const systemMoves = require('./src/game/moves/systemMoves');
const G = {
  fish: [{ id:'fish1', type:'tilapia', weight:10, health:10, ammoniaProductionRate:0.1, foodConsumptionRate:0.2 }],
  aquaponicsSystem:{ tank:{ foodInTank:0, water:{ ammonia:1.5, nitrite:0.8, nitrate:3, pH:6.3, dissolvedOxygen:6 } } },
  gameTime:0,
  equipment:{},
  inventory:{produce:{}}
};
const result1 = fishMoves.feedFish({G, ctx:{currentPlayer:'0'}}, null, null, 5);
console.log('feedFish', result1.lastAction.type, result1.lastAction.success);
const result2 = systemMoves.increaseAeration({G, ctx:{currentPlayer:'0'}}, 1.5);
console.log('increaseAeration', JSON.stringify(result2.lastAction));
const result3 = systemMoves.performPartialWaterChange({G, ctx:{currentPlayer:'0'}}, 0.2);
console.log('partialChange', JSON.stringify(result3.lastAction));
systemMoves.progressTurn({G, ctx:{currentPlayer:'0'}});
console.log('progressTurn', G.gameTime, JSON.stringify(G.systemAlerts), G.lastAction && G.lastAction.type);
