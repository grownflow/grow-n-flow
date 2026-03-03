const { AquaponicsSystem } = require('../models/AquaponicsSystem');
const { EventManager } = require('../utils/EventManager');
const { equipment } = require('../data/equipment');
const { EVENTS } = require('../data/events');

const systemMoves = {
  progressTurn: ({ G, ctx }) => {
    console.log('[progressTurn] G.gameTime before:', G.gameTime);
    // Ensure aquaponicsSystem exists as plain object
    if (!G.aquaponicsSystem) {
      G.aquaponicsSystem = {
        tank: { water: {} },
        growBeds: {},
        light: { isOn: true }
      };
    }
    
    // Apply active event effects before processing turn
    EventManager.applyEventEffects(G);
    
    // Simple turn progression without class methods
    G.gameTime += 1; /* Day */
    console.log('[progressTurn] G.gameTime after:', G.gameTime);

    // Age fish and grow them
    if (G.fish && G.fish.length > 0) {
      G.fish.forEach(fish => {
        fish.age += 1;
        fish.weight += fish.growthRate || 0;
      });
    }

    // Age plants and advance growth stages
    if (G.plants && G.plants.length > 0) {
      G.plants.forEach(plant => {
        plant.age += 1;
        const progress = plant.age / (plant.growthDays || 42);
        if (progress >= 1.0) {
          plant.growthStage = 'mature';
        } else if (progress >= 0.3) {
          plant.growthStage = 'growing';
        } else {
          plant.growthStage = 'seedling';
        }
      });
    }

    // Calculate daily utility costs
    const dailyUtilityCosts = calculateDailyUtilityCosts(G);
    
    // Initialize billsAccrued if it doesn't exist (for old save games)
    if (!G.billsAccrued) {
      G.billsAccrued = { electricity: 0, water: 0 };
      G.lastBillPaid = 0;
    }
    
    // Accumulate daily costs
    G.billsAccrued.electricity += dailyUtilityCosts.electricity;
    G.billsAccrued.water += dailyUtilityCosts.water;
    
    // Check if monthly bill is due (every 30 days)
    const daysSinceLastBill = G.gameTime - (G.lastBillPaid || 0);
    let billPayment = null;
    
    if (daysSinceLastBill >= 30) {
      const totalBill = G.billsAccrued.electricity + G.billsAccrued.water;
      
      billPayment = {
        electricity: Number(G.billsAccrued.electricity.toFixed(2)),
        water: Number(G.billsAccrued.water.toFixed(2)),
        total: Number(totalBill.toFixed(2)),
        paid: G.money >= totalBill
      };
      
      if (G.money >= totalBill) {
        G.money -= totalBill;
        G.billsAccrued = { electricity: 0, water: 0 };
        G.lastBillPaid = G.gameTime;
      } else {
        // Insufficient funds - deduct what they can afford and carry debt
        const debt = totalBill - G.money;
        G.money = 0;
        billPayment.debt = Number(debt.toFixed(2));
        billPayment.paid = false;
      }
    }
    
    // Check for random events
    const triggeredEvent = EventManager.checkForRandomEvent(G);
    if (triggeredEvent) {
      console.log(`[progressTurn] EVENT TRIGGERED: "${triggeredEvent.name}" - ${triggeredEvent.description} (duration: ${triggeredEvent.duration} days)`);
    }
    if (G.activeEvent) {
      console.log(`[progressTurn] Active event: "${G.activeEvent.name}" - ${G.activeEvent.turnsRemaining} turns remaining`);
    }
    
    // Progress active event duration
    EventManager.progressEvent(G);
    
    // Build serializable lastAction without any complex objects
    const lastAction = { 
      type: 'progressTurn',
      gameTime: G.gameTime,
      dailyUtilityCosts: {
        electricity: Number(dailyUtilityCosts.electricity.toFixed(2)),
        water: Number(dailyUtilityCosts.water.toFixed(2))
      },
      billsAccrued: {
        electricity: Number(G.billsAccrued.electricity.toFixed(2)),
        water: Number(G.billsAccrued.water.toFixed(2))
      }
    };
    
    if (billPayment) {
      console.log(`[progressTurn] BILL DUE: $${billPayment.total} (electricity: $${billPayment.electricity}, water: $${billPayment.water}) - ${billPayment.paid ? 'PAID' : 'UNPAID'}`);
      lastAction.billPayment = {
        electricity: billPayment.electricity,
        water: billPayment.water,
        total: billPayment.total,
        paid: billPayment.paid
      };
      if (billPayment.debt) {
        lastAction.billPayment.debt = billPayment.debt;
      }
    }
    
    if (triggeredEvent) {
      lastAction.eventTriggered = true;
      lastAction.eventName = String(triggeredEvent.name || '');
      lastAction.eventDescription = String(triggeredEvent.description || '');
    } else {
      lastAction.eventTriggered = false;
    }
    
    G.lastAction = lastAction;
  },

  // Repair system damage from events (leaks, pump failures, etc.)
  repairSystem: ({ G, ctx }) => {
    if (!G.activeEvent) {
      G.error = 'No active system damage to repair';
      G.lastAction = { type: 'repairSystem', success: false, reason: 'no_damage' };
      return;
    }

    const event = G.activeEvent;
    const eventData = EVENTS[event.id];
    
    // Check if this event is repairable
    if (!eventData || !eventData.repairCost) {
      G.error = `Event "${event.name}" cannot be repaired`;
      G.lastAction = { type: 'repairSystem', success: false, reason: 'not_repairable' };
      return;
    }

    const repairCost = eventData.repairCost;
    
    // Check if player has enough money
    if (G.money < repairCost) {
      G.error = `Insufficient funds. Repair costs $${repairCost}, have $${G.money.toFixed(2)}`;
      G.lastAction = { type: 'repairSystem', eventName: event.name, success: false, reason: 'insufficient_funds' };
      return;
    }

    // Deduct repair cost
    G.money -= repairCost;
    
    // Restore system to normal state
    if (event.effects.waterLossPerTurn && G.aquaponicsSystem && G.aquaponicsSystem.tank) {
      // Refill tank to full as part of repair
      G.aquaponicsSystem.tank.currentWaterLevel = G.aquaponicsSystem.tank.volumeLiters;
    }
    
    if (event.effects.biofilterEfficiencyReduction && G.aquaponicsSystem && G.aquaponicsSystem.tank) {
      // Restore biofilter efficiency
      G.aquaponicsSystem.tank.biofilterEfficiency = 0.8;
    }
    
    // Clear the event
    const repairedEvent = event.name;
    G.activeEvent = null;
    G.eventEffects = {};
    
    G.lastAction = {
      type: 'repairSystem',
      eventRepaired: repairedEvent,
      cost: repairCost,
      success: true
    };
  }
};

// Calculate daily utility costs based on equipment and system state
function calculateDailyUtilityCosts(G) {
  let electricityCost = 0.5; // Base electricity cost (reduced from 5.0)
  let waterCost = 0.2; // Base water cost (reduced from 2.0)
  
  // Add electricity costs from owned equipment
  if (G.equipment) {
    Object.entries(G.equipment).forEach(([equipmentType, quantity]) => {
      const equipmentData = equipment[equipmentType];
      if (equipmentData && equipmentData.dailyElectricityCost) {
        electricityCost += (equipmentData.dailyElectricityCost * 0.1) * quantity; // 10% of equipment cost
      }
    });
  }
  
  // Add water costs based on tank volume
  if (G.aquaponicsSystem && G.aquaponicsSystem.tank) {
    const tankVolume = G.aquaponicsSystem.tank.volumeLiters || 1000;
    waterCost += tankVolume / 2000; // 1000L tank = $0.50/day water (reduced from $5)
  }
  
  // Add extra water cost if there's an active leak
  if (G.activeEvent && G.activeEvent.effects && G.activeEvent.effects.waterLossPerTurn) {
    waterCost += 2; // Leak penalty (reduced from 15)
  }
  
  return { electricity: electricityCost, water: waterCost };
}

module.exports = systemMoves;