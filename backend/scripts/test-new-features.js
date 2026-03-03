// Manual test script for utility bills and damage system
const { AquaponicsGame } = require('../src/game/game');
const moves = require('../src/game/moves');

console.log('=== Testing Utility Bills & Damage System ===\n');

// Initialize game state
let G = AquaponicsGame.setup();
G.money = 5000; // Give more money for testing
const ctx = { currentPlayer: '0' };

console.log('Initial State:');
console.log(`- Money: $${G.money}`);
console.log(`- Game Time: Day ${G.gameTime}`);
console.log(`- Bills Accrued: Electricity $${G.billsAccrued.electricity}, Water $${G.billsAccrued.water}`);
console.log(`- Tank Water Level: ${G.aquaponicsSystem.tank.currentWaterLevel}L / ${G.aquaponicsSystem.tank.volumeLiters}L\n`);

// Buy some equipment to increase electricity costs
console.log('--- Buying Equipment ---');
G = moves.buyEquipment(G, ctx, 'growLight', 2);
G = moves.buyEquipment(G, ctx, 'waterPump', 1);
console.log(`After purchases - Money: $${G.money}\n`);

// Progress 5 turns to accumulate some bills
console.log('--- Progressing 5 Days ---');
for (let i = 0; i < 5; i++) {
  G = moves.progressTurn(G, ctx);
  console.log(`Day ${G.gameTime}: Bills Accrued - Elec: $${G.billsAccrued.electricity.toFixed(2)}, Water: $${G.billsAccrued.water.toFixed(2)}`);
  if (G.lastAction.dailyUtilityCosts) {
    console.log(`  Daily costs: Elec $${G.lastAction.dailyUtilityCosts.electricity}, Water $${G.lastAction.dailyUtilityCosts.water}`);
  }
}
console.log();

// Progress to day 30 to trigger bill payment
console.log('--- Fast-forwarding to Day 30 (Bill Payment) ---');
while (G.gameTime < 30) {
  G = moves.progressTurn(G, ctx);
}
console.log(`Day ${G.gameTime}:`);
if (G.lastAction.billPayment) {
  console.log(`  Bill Payment:`);
  console.log(`    - Electricity: $${G.lastAction.billPayment.electricity}`);
  console.log(`    - Water: $${G.lastAction.billPayment.water}`);
  console.log(`    - Total: $${G.lastAction.billPayment.total}`);
  console.log(`    - Paid: ${G.lastAction.billPayment.paid}`);
  if (G.lastAction.billPayment.debt) {
    console.log(`    - Debt: $${G.lastAction.billPayment.debt}`);
  }
}
console.log(`  Money after bill: $${G.money.toFixed(2)}`);
console.log(`  Bills accrued reset: Elec $${G.billsAccrued.electricity}, Water $${G.billsAccrued.water}\n`);

// Test damage system by manually triggering a leak
console.log('--- Testing Damage System ---');
const waterLevelBefore = G.aquaponicsSystem.tank.currentWaterLevel;
console.log(`Water level before leak: ${waterLevelBefore}L / ${G.aquaponicsSystem.tank.volumeLiters}L (100%)\n`);

const { EventManager } = require('../src/game/utils/EventManager');
G = { ...G };
EventManager.triggerEvent(G, 'waterLeak');
console.log(`Triggered event: ${G.activeEvent.name}`);
console.log(`  Description: ${G.activeEvent.description}`);
console.log(`  Water loss per turn: ${G.activeEvent.effects.waterLossPerTurn}L`);
console.log(`  Repair Cost: $${G.activeEvent.repairCost || 'N/A'}\n`);

// Progress a few turns to see leak effect
console.log('--- Leak Active for 3 Days ---');
for (let i = 0; i < 3; i++) {
  G = moves.progressTurn(G, ctx);
  const waterLevel = G.aquaponicsSystem.tank.currentWaterLevel;
  const percent = ((waterLevel / G.aquaponicsSystem.tank.volumeLiters) * 100).toFixed(1);
  const lostThisTurn = G.activeEvent.effects.waterLossPerTurn;
  console.log(`Day ${G.gameTime}: Water Level: ${waterLevel}L (${percent}%) [Lost ${lostThisTurn}L]`);
}
console.log();

// Try to repair the leak
console.log('--- Attempting Repair ---');
const moneyBefore = G.money;
G = moves.repairSystem(G, ctx);
if (G.lastAction.success) {
  console.log(`✅ Repair successful!`);
  console.log(`  Event repaired: ${G.lastAction.eventRepaired}`);
  console.log(`  Cost: $${G.lastAction.cost}`);
  console.log(`  Money: $${moneyBefore.toFixed(2)} → $${G.money.toFixed(2)}`);
  console.log(`  Tank refilled: ${G.aquaponicsSystem.tank.currentWaterLevel}L`);
  console.log(`  Active event: ${G.activeEvent || 'None'}`);
} else {
  console.log(`❌ Repair failed: ${G.error}`);
}
console.log();

console.log('=== All Tests Complete ===');
