const { AquaponicsSystem } = require('../models/AquaponicsSystem');
const { EventManager } = require('../utils/EventManager');
const { equipment } = require('../data/equipment');
const { EVENTS } = require('../data/events');

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ensureTankAndWaterState(G) {
  if (!G.aquaponicsSystem) {
    G.aquaponicsSystem = { tank: {}, growBeds: {}, light: { isOn: true } };
  }

  if (!G.aquaponicsSystem.tank) {
    G.aquaponicsSystem.tank = {};
  }

  const tank = G.aquaponicsSystem.tank;

  // Normalize volume fields (frontend uses capacity/currentVolume, older code uses volumeLiters/currentWaterLevel)
  const capacity = Number.isFinite(Number(tank.capacity))
    ? Number(tank.capacity)
    : (Number.isFinite(Number(tank.volumeLiters)) ? Number(tank.volumeLiters) : 1000);

  tank.capacity = capacity;
  tank.volumeLiters = capacity;

  const current = Number.isFinite(Number(tank.currentVolume))
    ? Number(tank.currentVolume)
    : (Number.isFinite(Number(tank.currentWaterLevel)) ? Number(tank.currentWaterLevel) : capacity);

  tank.currentVolume = clampNumber(current, 0, capacity);
  tank.currentWaterLevel = tank.currentVolume;

  tank.biofilterEfficiency = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);

  if (!tank.water) tank.water = {};
  const water = tank.water;

  // Fill in defaults if missing. Keep these plain JSON values.
  water.ammonia = clampNumber(water.ammonia ?? 0, 0, 1000);
  water.nitrite = clampNumber(water.nitrite ?? 0, 0, 1000);
  water.nitrate = clampNumber(water.nitrate ?? 10, 0, 10000);

  water.pH = clampNumber(water.pH ?? 7.0, 0, 14);
  water.temperature = clampNumber(water.temperature ?? 25, -10, 60);
  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen ?? 8.0, 0, 20);

  water.phosphorus = clampNumber(water.phosphorus ?? 5, 0, 10000);
  water.potassium = clampNumber(water.potassium ?? 40, 0, 10000);
  water.calcium = clampNumber(water.calcium ?? 60, 0, 10000);
  water.magnesium = clampNumber(water.magnesium ?? 20, 0, 10000);
  water.iron = clampNumber(water.iron ?? 2, 0, 10000);

  // Light state normalization (events can disable lights via G.eventEffects)
  if (!G.aquaponicsSystem.light) {
    G.aquaponicsSystem.light = { isOn: true };
  }
  if (typeof G.aquaponicsSystem.light.isOn !== 'boolean') {
    G.aquaponicsSystem.light.isOn = true;
  }

  return { tank, water };
}

function estimateDailyAmmoniaFromFish(fishArray) {
  // Heuristic: treat ammonia values as mg/L (ppm). This is tuned to roughly
  // put small systems into the UI warning range if overstocked.
  if (!Array.isArray(fishArray) || fishArray.length === 0) return 0;

  let biomassKg = 0;
  let rateSum = 0;
  for (const fish of fishArray) {
    const weightG = Number(fish?.weight ?? 0);
    if (Number.isFinite(weightG) && weightG > 0) biomassKg += weightG / 1000;
    const r = Number(fish?.ammoniaProductionRate ?? 0);
    if (Number.isFinite(r) && r > 0) rateSum += r;
  }

  // Baseline per-fish + biomass component.
  // NOTE: UI displays ammonia/nitrite/nitrate with 2 decimals, so values must move
  // by ~0.01/day to be visible. These coefficients intentionally produce visible
  // changes with small fish counts.
  const perFish = fishArray.length * 0.25;
  const byBiomass = biomassKg * 0.9;
  const bySpeciesRate = rateSum * 0.25;

  return Math.max(0, perFish + byBiomass + bySpeciesRate);
}

function applyNitrificationStep({ water, biofilterEfficiency, circulationStopped }) {
  // Simple 1-day step: ammonia -> nitrite -> nitrate.
  // Keep ammonia/nitrite persistent (do NOT zero them out).
  const eff = clampNumber(biofilterEfficiency, 0, 1);
  const circulationMult = circulationStopped ? 0.15 : 1.0;
  const k = 0.65 * eff * circulationMult; // fraction converted per day (0..~0.65)

  const ammoniaToNitrite = Math.min(water.ammonia, water.ammonia * k);
  water.ammonia = Math.max(0, water.ammonia - ammoniaToNitrite);
  water.nitrite += ammoniaToNitrite;

  const nitriteToNitrate = Math.min(water.nitrite, water.nitrite * k);
  water.nitrite = Math.max(0, water.nitrite - nitriteToNitrate);
  water.nitrate += nitriteToNitrate;

  // Nitrification acidifies water a bit.
  water.pH = clampNumber(water.pH - 0.01 * (ammoniaToNitrite + nitriteToNitrate), 6.0, 8.0);

  return { ammoniaToNitrite, nitriteToNitrate, k };
}

function applyPlantNitrateUptake({ G, water, lightsAvailable }) {
  if (!Array.isArray(G.plants) || G.plants.length === 0) return { nitrateUptake: 0 };
  if (!lightsAvailable) return { nitrateUptake: 0 };

  // Heuristic uptake in ppm/day. Seedlings use less, mature use more.
  let uptake = 0;
  for (const plant of G.plants) {
    const stage = String(plant?.growthStage || 'seedling');
    if (stage === 'mature') uptake += 0.06;
    else if (stage === 'growing') uptake += 0.04;
    else uptake += 0.02;
  }

  const nitrateUptake = Math.min(water.nitrate, uptake);
  water.nitrate = Math.max(0, water.nitrate - nitrateUptake);
  return { nitrateUptake };
}

const systemMoves = {
  progressTurn: ({ G, ctx }) => {
    console.log('[progressTurn] G.gameTime before:', G.gameTime);
    const { tank, water } = ensureTankAndWaterState(G);
    
    // Apply active event effects before processing turn
    EventManager.applyEventEffects(G);

    // Event effects may have mutated volume/efficiency; keep both schemas in sync.
    if (tank.currentWaterLevel !== tank.currentVolume) {
      tank.currentVolume = clampNumber(tank.currentWaterLevel, 0, tank.capacity);
      tank.currentWaterLevel = tank.currentVolume;
    }
    tank.biofilterEfficiency = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
    
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

    // --- Water chemistry (nitrification cycle) ---
    // Fish produce ammonia daily ("eat food and shit" modeled as waste generation).
    const ammoniaInput = estimateDailyAmmoniaFromFish(G.fish);
    water.ammonia = clampNumber(water.ammonia + ammoniaInput, 0, 1000);

    // Lights may be disabled by events; treat that as no plant uptake for now.
    const lightsDisabled = Boolean(G.eventEffects?.lightsDisabled);
    const lightsAvailable = !lightsDisabled && Boolean(G.aquaponicsSystem?.light?.isOn);

    const nitrification = applyNitrificationStep({
      water,
      biofilterEfficiency: tank.biofilterEfficiency,
      circulationStopped: Boolean(G.eventEffects?.circulationStopped),
    });

    const uptake = applyPlantNitrateUptake({ G, water, lightsAvailable });

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
      },
      waterDelta: {
        ammoniaInput: Number(ammoniaInput.toFixed(3)),
        ammoniaToNitrite: Number(nitrification.ammoniaToNitrite.toFixed(3)),
        nitriteToNitrate: Number(nitrification.nitriteToNitrate.toFixed(3)),
        nitrateUptake: Number((uptake.nitrateUptake || 0).toFixed(3)),
        effectiveConversionFraction: Number(nitrification.k.toFixed(3))
      },
      lightsAvailable
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
      const cap = Number(G.aquaponicsSystem.tank.capacity || G.aquaponicsSystem.tank.volumeLiters || 1000);
      G.aquaponicsSystem.tank.capacity = cap;
      G.aquaponicsSystem.tank.volumeLiters = cap;
      G.aquaponicsSystem.tank.currentWaterLevel = cap;
      G.aquaponicsSystem.tank.currentVolume = cap;
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