const { AquaponicsSystem } = require('../models/AquaponicsSystem');
const { EventManager } = require('../utils/EventManager');
const { equipment } = require('../data/equipment');
const { EVENTS } = require('../data/events');
const { fishSpecies } = require('../data/fishSpecies');
const { plantSpecies } = require('../data/plantSpecies');
const { EnvironmentalStress } = require('../utils/environmentalStress');

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

  tank.foodInTank = clampNumber(tank.foodInTank ?? 0, 0, 1e9);
  // Uneaten/expired food becomes sediment (waste). This persists across days.
  tank.sediment = clampNumber(tank.sediment ?? 0, 0, 1e12);

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
  tank.circulationEfficiency = clampNumber(tank.circulationEfficiency ?? 1.0, 0.5, 2.0);

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

function distributeTankFoodByNeed({ availableFood, needs }) {
  const portions = new Array(needs.length).fill(0);
  let remaining = clampNumber(availableFood, 0, 1e9);

  let remainingIndices = needs
    .map((need, idx) => ({ need: clampNumber(need, 0, 1e9), idx }))
    .filter((x) => x.need > 0)
    .map((x) => x.idx);

  let guard = 0;
  while (remaining > 1e-9 && remainingIndices.length > 0 && guard < 1000) {
    guard += 1;
    const share = remaining / remainingIndices.length;

    const next = [];
    let changed = false;
    for (const idx of remainingIndices) {
      const need = clampNumber(needs[idx], 0, 1e9);
      const cap = Math.max(0, need - portions[idx]);
      const give = Math.min(cap, share);
      if (give > 0) {
        portions[idx] += give;
        remaining -= give;
        changed = true;
      }
      if (cap - give > 1e-9) next.push(idx);
    }

    if (!changed) break;
    if (next.length === remainingIndices.length) {
      // None of the fish hit their need caps; spread the remainder evenly and stop.
      const add = remaining / remainingIndices.length;
      for (const idx of remainingIndices) {
        portions[idx] += add;
      }
      remaining = 0;
      break;
    }
    remainingIndices = next;
  }

  const totalEaten = clampNumber(availableFood - remaining, 0, availableFood);
  return { portions, totalEaten };
}

function applyDailyFishFeedingFromTank({ G, tank, water }) {
  if (!Array.isArray(G.fish) || G.fish.length === 0) {
    return {
      tankFoodBefore: Number(tank.foodInTank || 0),
      totalEaten: 0,
      tankFoodAfter: Number(tank.foodInTank || 0),
      fishFed: 0,
      totalWeightGain: 0,
      totalHealthDelta: 0,
      avgStress: 0,
      fishDeaths: [],
      fishDebug: [],
      waterSnapshot: {
        temperature: Number(water?.temperature ?? 0),
        ammonia: Number(water?.ammonia ?? 0),
        dissolvedOxygen: Number(water?.dissolvedOxygen ?? 0),
      },
      waterDelta: { ammonia: 0, dissolvedOxygen: 0 },
    };
  }

  const tankFoodBefore = clampNumber(tank.foodInTank ?? 0, 0, 1e9);
  const availableFood = tankFoodBefore;

  const temperature = Number(water.temperature ?? 25);
  const ammonia = Number(water.ammonia ?? 0);
  const oxygen = Number(water.dissolvedOxygen ?? 8);

  // Daily "need" per fish (units match fishFood units).
  const needs = G.fish.map((fish) => {
    const speciesKey = String(fish?.type || '').toLowerCase();
    const species = fishSpecies[speciesKey] || fishSpecies.tilapia;
    return clampNumber(fish?.foodConsumptionRate ?? species.foodConsumptionRate ?? 0.2, 0.05, 10);
  });

  const { portions, totalEaten } = distributeTankFoodByNeed({ availableFood, needs });

  let fishFed = 0;
  let totalWeightGain = 0;
  let totalHealthDelta = 0;
  let totalAmmoniaDelta = 0;
  let totalOxygenDelta = 0;
  let stressOverallSum = 0;
  const fishDeaths = [];
  const fishDebug = [];

  for (let i = 0; i < G.fish.length; i += 1) {
    const fish = G.fish[i];
    if (!fish) continue;

    if (!Number.isFinite(Number(fish.weight))) fish.weight = 10;
    if (!Number.isFinite(Number(fish.health))) fish.health = 10;

    const portion = clampNumber(portions[i] ?? 0, 0, 1e9);
    if (portion > 0) fishFed += 1;

    const speciesKey = String(fish.type || '').toLowerCase();
    const species = fishSpecies[speciesKey] || fishSpecies.tilapia;

    const stress = EnvironmentalStress.calculateOverallStress(temperature, ammonia, oxygen, species);
    stressOverallSum += Number(stress?.overall || 0);

    const requiredFood = clampNumber(needs[i] ?? 0.2, 0.05, 10);
    const foodRatio = requiredFood > 0 ? clampNumber(portion / requiredFood, 0, 1) : 0;
    const stressFactor = clampNumber(1 - Number(stress.overall || 0), 0, 1);

    const beforeHealth = Number(fish.health);
    const beforeWeight = Number(fish.weight);

    const baseGrowth = Number(fish.growthRate ?? species.baseGrowthRate ?? 0);
    const weightGain = Math.max(0, baseGrowth * foodRatio * stressFactor);
    fish.weight = Math.max(0, beforeWeight + weightGain);

    let healthDelta = 0;
    if (foodRatio < 0.8 || Number(stress.overall || 0) > 0.3) {
      healthDelta -= (1 - foodRatio) * 1.2 + Number(stress.overall || 0) * 1.6;
    } else {
      healthDelta += 0.35;
    }
    fish.health = clampNumber(beforeHealth + healthDelta, 0, 10);

    // Debug payload for UI (kept small + serializable)
    if (fishDebug.length < 100) {
      fishDebug.push({
        id: String(fish.id ?? ''),
        type: String(fish.type ?? ''),
        portion: Number(portion.toFixed(3)),
        requiredFood: Number(requiredFood.toFixed(3)),
        foodRatio: Number(foodRatio.toFixed(3)),
        stress: {
          temperature: Number(Number(stress.temperature || 0).toFixed(3)),
          ammonia: Number(Number(stress.ammonia || 0).toFixed(3)),
          oxygen: Number(Number(stress.oxygen || 0).toFixed(3)),
          overall: Number(Number(stress.overall || 0).toFixed(3)),
        },
        thresholds: {
          tempMin: Number(species?.tempRange?.min ?? 0),
          tempOptMin: Number(species?.tempRange?.optimal?.min ?? 0),
          tempOptMax: Number(species?.tempRange?.optimal?.max ?? 0),
          tempMax: Number(species?.tempRange?.max ?? 0),
          ammoniaToleranceMax: Number(species?.ammoniaToleranceMax ?? 0),
          oxygenMin: Number(species?.oxygenMin ?? 0),
        },
        health: {
          before: Number(beforeHealth.toFixed(3)),
          delta: Number(healthDelta.toFixed(3)),
          after: Number(Number(fish.health).toFixed(3)),
        },
        weight: {
          before: Number(beforeWeight.toFixed(3)),
          gain: Number(weightGain.toFixed(3)),
          after: Number(Number(fish.weight).toFixed(3)),
        },
      });
    }

    if (Number(fish.health) <= 0) {
      fishDeaths.push({
        id: String(fish.id ?? ''),
        type: String(fish.type ?? ''),
        age: Number(fish.age ?? 0),
        weight: Number(fish.weight ?? 0),
      });
      fish._dead = true;
    }

    if (portion > 0) {
      fish.lastFedAt = Date.now();
      if (Number.isFinite(Number(G.gameTime))) fish.lastFedDay = Number(G.gameTime);
    }

    totalWeightGain += weightGain;
    totalHealthDelta += (Number(fish.health) - beforeHealth);

    // Eating increases waste load: ammonia up, oxygen down.
    const fishAmmoniaRate = clampNumber(Number(fish.ammoniaProductionRate ?? species.ammoniaProductionRate ?? 0.1), 0, 10);
    const ammoniaDelta = portion * (0.03 + 0.02 * fishAmmoniaRate);
    const oxygenDelta = portion * 0.02;
    totalAmmoniaDelta += ammoniaDelta;
    totalOxygenDelta += oxygenDelta;
  }

  const tankFoodAfter = clampNumber(tankFoodBefore - totalEaten, 0, 1e9);
  // Leftover food is not viable the next day.
  // Convert any uneaten tank food into sediment/waste and clear foodInTank.
  const uneatenConvertedToSediment = clampNumber(tankFoodAfter, 0, 1e9);
  tank.sediment = clampNumber(Number(tank.sediment ?? 0) + uneatenConvertedToSediment, 0, 1e12);
  tank.foodInTank = 0;

  if (fishDeaths.length > 0) {
    G.fish = G.fish.filter((fish) => fish && fish._dead !== true);
  }

  // Clean up internal marker if it exists on survivors.
  if (Array.isArray(G.fish) && G.fish.length > 0) {
    for (const fish of G.fish) {
      if (fish && fish._dead) delete fish._dead;
    }
  }

  water.ammonia = clampNumber(Number(water.ammonia) + totalAmmoniaDelta, 0, 1000);
  water.dissolvedOxygen = clampNumber(Number(water.dissolvedOxygen) - totalOxygenDelta, 0, 20);

  return {
    tankFoodBefore: Number(tankFoodBefore.toFixed(3)),
    totalEaten: Number(totalEaten.toFixed(3)),
    tankFoodAfter: Number(Number(tank.foodInTank || 0).toFixed(3)),
    uneatenConvertedToSediment: Number(uneatenConvertedToSediment.toFixed(3)),
    sedimentAfter: Number(Number(tank.sediment || 0).toFixed(3)),
    fishFed,
    totalWeightGain: Number(totalWeightGain.toFixed(3)),
    totalHealthDelta: Number(totalHealthDelta.toFixed(3)),
    avgStress: G.fish.length > 0 ? Number((stressOverallSum / G.fish.length).toFixed(3)) : 0,
    fishDeaths,
    fishDebug,
    waterSnapshot: {
      temperature: Number(temperature.toFixed(3)),
      ammonia: Number(ammonia.toFixed(3)),
      dissolvedOxygen: Number(oxygen.toFixed(3)),
    },
    waterDelta: {
      ammonia: Number(totalAmmoniaDelta.toFixed(3)),
      dissolvedOxygen: Number((-totalOxygenDelta).toFixed(3)),
    },
  };
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

function applyNitrificationStep({ water, biofilterEfficiency, circulationStopped, circulationEfficiency }) {
  // Simple 1-day step: ammonia -> nitrite -> nitrate.
  // Keep ammonia/nitrite persistent (do NOT zero them out).
  const eff = clampNumber(biofilterEfficiency, 0, 1);
  const circulationMult = circulationStopped ? 0.15 : 1.0;
  const circEff = clampNumber(circulationEfficiency ?? 1.0, 0.5, 2.0);
  const k = 0.65 * eff * circulationMult * circEff; // fraction converted per day

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

    // Age fish (growth/health changes are applied via daily tank feeding below)
    if (Array.isArray(G.fish) && G.fish.length > 0) {
      G.fish.forEach((fish) => {
        fish.age = (Number(fish.age) || 0) + 1;
      });
    }

    // Fish eat from tank food pool. Leftovers remain in the tank.
    const dailyFeeding = applyDailyFishFeedingFromTank({ G, tank, water });

    // --- Water chemistry (nitrification cycle) ---
    // Ammonia from daily feeding is applied inside applyDailyFishFeedingFromTank.
    // Keep this value for UI/telemetry.
    const ammoniaInput = Number(dailyFeeding?.waterDelta?.ammonia || 0);

    // Lights may be disabled by events; treat that as no plant uptake for now.
    const lightsDisabled = Boolean(G.eventEffects?.lightsDisabled);
    const lightsAvailable = !lightsDisabled && Boolean(G.aquaponicsSystem?.light?.isOn);

    const nitrification = applyNitrificationStep({
      water,
      biofilterEfficiency: tank.biofilterEfficiency,
      circulationStopped: Boolean(G.eventEffects?.circulationStopped),
      circulationEfficiency: tank.circulationEfficiency,
    });

    const uptake = applyPlantNitrateUptake({ G, water, lightsAvailable });

    // Age plants, apply nutrient-based health, and detect deaths
    let plantDeaths = [];
    if (G.plants && G.plants.length > 0) {
      const plantGrowthMult = clampNumber(G.systemModifiers?.plantGrowthMultiplier ?? 1.0, 0.5, 3.0);
      G.plants.forEach(plant => {
        plant.age += plantGrowthMult;
        const progress = plant.age / (plant.growthDays || 42);
        if (progress >= 1.0) {
          plant.growthStage = 'mature';
        } else if (progress >= 0.3) {
          plant.growthStage = 'growing';
        } else {
          plant.growthStage = 'seedling';
        }

        if (!Number.isFinite(Number(plant.health))) plant.health = 10;

        const species = plantSpecies[plant.type];
        const req = species?.nutrientRequirements || {};
        const pHRange = species?.pHRange || { min: 6.0, max: 7.5 };

        let deficits = 0;
        if (req.nitrogen   && water.nitrate    < req.nitrogen)   deficits += 1;
        if (req.phosphorus && water.phosphorus < req.phosphorus) deficits += 1;
        if (req.potassium  && water.potassium  < req.potassium)  deficits += 1;
        if (req.calcium    && water.calcium    < req.calcium)    deficits += 0.5;
        if (req.magnesium  && water.magnesium  < req.magnesium)  deficits += 0.5;
        if (req.iron       && water.iron       < req.iron)       deficits += 0.5;
        if (water.pH < pHRange.min || water.pH > (pHRange.max || 7.5)) deficits += 1;

        if (deficits > 0) {
          plant.health = clampNumber(Number(plant.health) - deficits * 0.3, 0, 10);
        } else {
          plant.health = clampNumber(Number(plant.health) + 0.1, 0, 10);
        }

        if (Number(plant.health) <= 0) plant._dead = true;
      });

      plantDeaths = G.plants
        .filter(p => p._dead)
        .map(p => ({ id: String(p.id || ''), type: String(p.type || ''), age: Number(p.age || 0) }));

      if (plantDeaths.length > 0) {
        G.plants = G.plants.filter(p => !p._dead);
      }
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
      fishFeeding: {
        tankFoodBefore: dailyFeeding.tankFoodBefore,
        totalEaten: dailyFeeding.totalEaten,
        tankFoodAfter: dailyFeeding.tankFoodAfter,
        uneatenConvertedToSediment: dailyFeeding.uneatenConvertedToSediment,
        sedimentAfter: dailyFeeding.sedimentAfter,
        fishFed: dailyFeeding.fishFed,
        totalWeightGain: dailyFeeding.totalWeightGain,
        totalHealthDelta: dailyFeeding.totalHealthDelta,
        avgStress: dailyFeeding.avgStress,
      },
      fishDeaths: Array.isArray(dailyFeeding.fishDeaths) ? dailyFeeding.fishDeaths : [],
      plantDeaths: plantDeaths,
      fishFeedingDebug: {
        waterSnapshot: dailyFeeding.waterSnapshot,
        fish: Array.isArray(dailyFeeding.fishDebug) ? dailyFeeding.fishDebug : [],
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

  // Perform a partial water change (e.g. 0.25 for 25%).
  // This dilutes tank concentrations toward a baseline "source water" profile.
  waterChange: ({ G, ctx }, fraction) => {
    const { tank, water } = ensureTankAndWaterState(G);

    const f = clampNumber(fraction, 0, 1);
    if (f <= 0) {
      G.lastAction = { type: 'waterChange', success: false, reason: 'invalid_fraction', fraction };
      return;
    }

    // Baseline for incoming replacement water. Keep this simple + deterministic.
    // If we later want configurable source water, store it at G.sourceWater.
    const source = {
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,
      pH: 7.2,
      temperature: clampNumber(water.temperature ?? 25, -10, 60),
      dissolvedOxygen: 8.0,
      phosphorus: 5,
      potassium: 40,
      calcium: 60,
      magnesium: 20,
      iron: 0.5,
    };

    const before = {
      ammonia: Number(water.ammonia ?? 0),
      nitrite: Number(water.nitrite ?? 0),
      nitrate: Number(water.nitrate ?? 0),
      pH: Number(water.pH ?? 7.0),
      temperature: Number(water.temperature ?? 25),
      dissolvedOxygen: Number(water.dissolvedOxygen ?? 8.0),
      phosphorus: Number(water.phosphorus ?? 0),
      potassium: Number(water.potassium ?? 0),
      calcium: Number(water.calcium ?? 0),
      magnesium: Number(water.magnesium ?? 0),
      iron: Number(water.iron ?? 0),
      sediment: Number(tank.sediment ?? 0),
    };

    // Mix model: new = old*(1-f) + source*f
    water.ammonia = clampNumber(before.ammonia * (1 - f) + source.ammonia * f, 0, 1000);
    water.nitrite = clampNumber(before.nitrite * (1 - f) + source.nitrite * f, 0, 1000);
    water.nitrate = clampNumber(before.nitrate * (1 - f) + source.nitrate * f, 0, 10000);
    water.pH = clampNumber(before.pH * (1 - f) + source.pH * f, 0, 14);
    water.temperature = clampNumber(before.temperature * (1 - f) + source.temperature * f, -10, 60);
    water.dissolvedOxygen = clampNumber(before.dissolvedOxygen * (1 - f) + source.dissolvedOxygen * f, 0, 20);
    water.phosphorus = clampNumber(before.phosphorus * (1 - f) + source.phosphorus * f, 0, 10000);
    water.potassium = clampNumber(before.potassium * (1 - f) + source.potassium * f, 0, 10000);
    water.calcium = clampNumber(before.calcium * (1 - f) + source.calcium * f, 0, 10000);
    water.magnesium = clampNumber(before.magnesium * (1 - f) + source.magnesium * f, 0, 10000);
    water.iron = clampNumber(before.iron * (1 - f) + source.iron * f, 0, 10000);

    // Sediment proxy: water change removes some suspended waste.
    tank.sediment = clampNumber(before.sediment * (1 - f), 0, 1e12);

    const after = {
      ammonia: Number(water.ammonia ?? 0),
      nitrite: Number(water.nitrite ?? 0),
      nitrate: Number(water.nitrate ?? 0),
      pH: Number(water.pH ?? 0),
      temperature: Number(water.temperature ?? 0),
      dissolvedOxygen: Number(water.dissolvedOxygen ?? 0),
      phosphorus: Number(water.phosphorus ?? 0),
      potassium: Number(water.potassium ?? 0),
      calcium: Number(water.calcium ?? 0),
      magnesium: Number(water.magnesium ?? 0),
      iron: Number(water.iron ?? 0),
      sediment: Number(tank.sediment ?? 0),
    };

    // Approximate liters replaced using normalized volume fields.
    const liters = clampNumber(Number(tank.currentVolume ?? tank.currentWaterLevel ?? tank.capacity ?? 0) * f, 0, 1e12);

    G.lastAction = {
      type: 'waterChange',
      success: true,
      fraction: Number(f.toFixed(3)),
      litersReplaced: Number(liters.toFixed(1)),
      before: {
        ammonia: Number(before.ammonia.toFixed(3)),
        nitrite: Number(before.nitrite.toFixed(3)),
        nitrate: Number(before.nitrate.toFixed(3)),
        pH: Number(before.pH.toFixed(3)),
        dissolvedOxygen: Number(before.dissolvedOxygen.toFixed(3)),
        sediment: Number(before.sediment.toFixed(3)),
      },
      after: {
        ammonia: Number(after.ammonia.toFixed(3)),
        nitrite: Number(after.nitrite.toFixed(3)),
        nitrate: Number(after.nitrate.toFixed(3)),
        pH: Number(after.pH.toFixed(3)),
        dissolvedOxygen: Number(after.dissolvedOxygen.toFixed(3)),
        sediment: Number(after.sediment.toFixed(3)),
      },
    };
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
      // Restore to the efficiency the tank had before the clog (may be above 0.8 if player bought biofilters)
      const base = Number(event._baseBiofilterEfficiency ?? 0.8);
      G.aquaponicsSystem.tank.biofilterEfficiency = clampNumber(base, 0, 1);
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