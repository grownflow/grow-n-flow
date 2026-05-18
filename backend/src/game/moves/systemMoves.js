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

function createSystemAlerts({ water, tank, G }) {
  const alerts = [];
  const ammonia = Number(water.ammonia ?? 0);
  const nitrite = Number(water.nitrite ?? 0);
  const nitrate = Number(water.nitrate ?? 0);
  const oxygen = Number(water.dissolvedOxygen ?? 0);
  const pH = Number(water.pH ?? 7.0);

  if (oxygen < 5.0) {
    alerts.push('Dissolved oxygen is below 5 ppm; immediately increase aeration and reduce feeding.');
  }

  if ((ammonia >= 1.0 || nitrite >= 1.0) && oxygen >= 5.0) {
    alerts.push('Fish may appear to gasp at the surface despite normal dissolved oxygen because ammonia or nitrite is impairing gill function. Test ammonia and nitrite, stop feeding, increase aeration, and perform a partial water change.');
  }

  if (ammonia >= 2.0) {
    alerts.push('Ammonia is spiking. Stop or drastically reduce feeding, remove dead fish if needed, and do a partial water change.');
  }

  if (nitrite >= 1.0) {
    alerts.push('Nitrite is rising to a stressful range. Reduce feeding, perform a partial water change, and check biofilter efficiency.');
    if (tank.biofilterEfficiency < 0.6) {
      alerts.push('Biofilter efficiency is low; buy or repair biofilter equipment.');
    }
  }

  if (nitrate <= 1.0) {
    alerts.push('Nitrate is near zero, which can mean ammonia is accumulating dangerously fast. Increase fish feeding gradually or reduce plant biomass to rebalance.');
  } else if (nitrate < 5.0) {
    alerts.push('Nitrate is unusually low; increase fish waste output or reduce plant nutrient demand.');
  }

  if (pH < 6.5) {
    alerts.push('pH is below the optimal range; add buffering solution (calcium carbonate or potassium carbonate) in small increments to raise pH toward 6.5–7.2.');
  }

  if (pH > 7.5) {
    alerts.push('High pH can lock up nutrients and stress plants; lower pH slowly toward 6.5–7.2.');
  }

  if (water.iron < 1.0) {
    alerts.push('Low iron can cause plant chlorosis. Add chelated iron to reach approximately 2 ppm.');
  }

  if (G && Array.isArray(G.fish) && G.fish.length === 0 && water.nitrate < 5.0) {
    alerts.push('Low nitrate with no fish present indicates insufficient nutrient production or too much plant biomass.');
  }

  return alerts;
}

function applyPlantHealthAndMortality({ G, water, lightsAvailable }) {
  const plantDeaths = [];
  if (!Array.isArray(G.plants) || G.plants.length === 0) return { plantDeaths };

  const pH = Number(water.pH ?? 7.0);
  const nitrate = Number(water.nitrate ?? 0);
  const iron = Number(water.iron ?? 0);
  const lowLightPenalty = lightsAvailable ? 0 : 0.5;

  for (const plant of G.plants) {
    const species = plantSpecies[plant.type] || {};
    const growthDays = Number(plant.growthDays || species.totalGrowthTime * 7 || 42);
    let healthPenalty = 0;

    if (nitrate < 3.0) {
      healthPenalty += (3.0 - nitrate) * 0.4;
    }

    if (pH < 6.0 || pH > 7.5) {
      healthPenalty += 1.2;
    } else if (pH < 6.2 || pH > 7.2) {
      healthPenalty += 0.6;
    }

    if (iron < 1.0) {
      healthPenalty += 0.5;
    }

    healthPenalty += lowLightPenalty;

    if (plant.age > growthDays * 1.5) {
      healthPenalty += 0.2;
    }
    if (plant.age > growthDays * 2) {
      healthPenalty += 0.5;
    }

    if (healthPenalty > 0) {
      plant.health = clampNumber(Number(plant.health) - healthPenalty, 0, 10);
    } else {
      // All conditions good — plants recover slowly, capped at 10.
      plant.health = clampNumber(Number(plant.health) + 0.15, 0, 10);
    }

    if (plant.health <= 0) {
      plantDeaths.push({ id: String(plant.id ?? ''), type: String(plant.type ?? ''), age: Number(plant.age ?? 0) });
      plant._dead = true;
    }
  }

  if (plantDeaths.length > 0) {
    G.plants = G.plants.filter((plant) => !plant._dead);
  }

  return { plantDeaths };
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
  const nitrite = Number(water.nitrite ?? 0);
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

    const stress = EnvironmentalStress.calculateOverallStress(temperature, ammonia, oxygen, species, Number(water.pH ?? 7.0), nitrite);
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

    const oldAgeDays = Number(fish.harvestTime ?? species.harvestTime ?? 0);
    if (oldAgeDays > 0 && fish.age > oldAgeDays + 30) {
      const agePenalty = Math.min(1.5, (fish.age - oldAgeDays - 30) / 30 * 0.5);
      healthDelta -= agePenalty;
    }

    // Extreme water conditions: all fish are affected (same water), but the penalty
    // is calibrated so the player has ~10 days to intervene before mass death.
    if (ammonia >= 3.0 || nitrite >= 2.0 || oxygen <= 2.0) {
      healthDelta -= 0.8;
    }

    fish.health = clampNumber(beforeHealth + healthDelta, 0, 10);

    // Starvation: track consecutive days without any food.
    // Each unfed day past the first adds an escalating penalty; death is unconditional at 5 days.
    const daysUnfed = portion === 0 ? (Number(fish.daysWithoutFood) || 0) + 1 : 0;
    fish.daysWithoutFood = daysUnfed;
    if (daysUnfed >= 5) {
      fish.health = 0;
    } else if (daysUnfed >= 2) {
      fish.health = clampNumber(fish.health - (daysUnfed - 1) * 0.4, 0, 10);
    }

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
          daysWithoutFood: daysUnfed,
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
      fish.daysWithoutFood = 0;
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
  const oxygenFactor = water.dissolvedOxygen < 5.0 ? clampNumber(water.dissolvedOxygen / 5.0, 0.1, 1.0) : 1.0;
  const k = 0.65 * eff * circulationMult * circEff * oxygenFactor; // fraction converted per day

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

function performPartialWaterChange({ G, ctx }, percent = 0.2) {
  const { tank, water } = ensureTankAndWaterState(G);
  const ratio = clampNumber(1 - Number(percent), 0.5, 0.95);

  const ammoniaBefore = Number(water.ammonia);
  const nitriteBefore = Number(water.nitrite);
  const nitrateBefore = Number(water.nitrate);

  water.ammonia = clampNumber(water.ammonia * ratio, 0, 1000);
  water.nitrite = clampNumber(water.nitrite * ratio, 0, 1000);
  water.nitrate = clampNumber(water.nitrate * ratio, 0, 10000);
  water.phosphorus = clampNumber(water.phosphorus * ratio, 0, 10000);
  water.potassium = clampNumber(water.potassium * ratio, 0, 10000);
  water.calcium = clampNumber(water.calcium * ratio, 0, 10000);
  water.magnesium = clampNumber(water.magnesium * ratio, 0, 10000);
  water.iron = clampNumber(water.iron * ratio, 0, 10000);

  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen + (1 - ratio) * 4, 0, 20);
  G.billsAccrued = G.billsAccrued || { electricity: 0, water: 0 };
  G.billsAccrued.water += Number(((1 - ratio) * 0.3).toFixed(3));

  G.lastAction = {
    type: 'performPartialWaterChange',
    success: true,
    percentReplaced: Number(((1 - ratio) * 100).toFixed(1)),
    ammoniaBefore: Number(ammoniaBefore.toFixed(3)),
    ammoniaAfter: Number(water.ammonia.toFixed(3)),
    nitriteBefore: Number(nitriteBefore.toFixed(3)),
    nitriteAfter: Number(water.nitrite.toFixed(3)),
    nitrateBefore: Number(nitrateBefore.toFixed(3)),
    nitrateAfter: Number(water.nitrate.toFixed(3)),
    dissolvedOxygenAfter: Number(water.dissolvedOxygen.toFixed(3))
  };

  return G;
}

function stopFeeding({ G, ctx }) {
  const { tank } = ensureTankAndWaterState(G);
  const removed = Number(tank.foodInTank || 0);
  tank.foodInTank = 0;

  G.lastAction = {
    type: 'stopFeeding',
    success: true,
    removedFood: Number(removed.toFixed(3))
  };

  return G;
}

function increaseAeration({ G, ctx }, amount = 1.0) {
  const { water, tank } = ensureTankAndWaterState(G);
  const oxygenAdded = clampNumber(Number(amount), 0.1, 5.0);
  const before = Number(water.dissolvedOxygen);
  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen + oxygenAdded, 0, 20);
  tank.circulationEfficiency = clampNumber((tank.circulationEfficiency ?? 1.0) + 0.1, 0.5, 2.0);

  G.lastAction = {
    type: 'increaseAeration',
    success: true,
    dissolvedOxygenBefore: Number(before.toFixed(3)),
    dissolvedOxygenAfter: Number(water.dissolvedOxygen.toFixed(3)),
    circulationEfficiency: Number(tank.circulationEfficiency.toFixed(3))
  };

  return G;
}

function runOneTurn(G) {
  const { tank, water } = ensureTankAndWaterState(G);
    
    // Apply active event effects before processing turn
    EventManager.applyEventEffects(G);

    // Event effects may have mutated volume/efficiency; keep both schemas in sync.
    if (tank.currentWaterLevel !== tank.currentVolume) {
      tank.currentVolume = clampNumber(tank.currentWaterLevel, 0, tank.capacity);
      tank.currentWaterLevel = tank.currentVolume;
    }
    tank.biofilterEfficiency = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
    
    G.gameTime += 1;

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

    G.systemAlerts = createSystemAlerts({ water, tank, G });

    // Age plants and advance growth stages
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
      });

      const mortality = applyPlantHealthAndMortality({ G, water, lightsAvailable });
      plantDeaths = mortality.plantDeaths || [];
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
      
      const paid = Math.min(G.money, totalBill);
      const unpaid = totalBill - paid;
      G.money = parseFloat((G.money - paid).toFixed(2));
      // Always reset the billing cycle so it doesn't re-fire every turn.
      G.billsAccrued = { electricity: 0, water: 0 };
      G.lastBillPaid = G.gameTime;
      billPayment.paid = unpaid <= 0;
      if (unpaid > 0) {
        billPayment.debt = Number(unpaid.toFixed(2));
      }
    }
    
    // Check for random events
    const triggeredEvent = EventManager.checkForRandomEvent(G);
    if (triggeredEvent) {
      console.log(`[progressTurn] EVENT TRIGGERED: "${triggeredEvent.name}" - ${triggeredEvent.description} (duration: ${triggeredEvent.duration} days)`);
      // Apply the newly triggered event's effects in the same turn it fires.
      // Without this, duration-1 events (triggered at end of turn, cleared by
      // progressEvent below) would never have their effects applied at all.
      EventManager.applyEventEffects(G);
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
      plantDeaths: Array.isArray(plantDeaths) ? plantDeaths : [],
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
    
    lastAction.systemAlerts = Array.isArray(G.systemAlerts) ? G.systemAlerts : [];
    if (triggeredEvent) {
      lastAction.eventTriggered = true;
      lastAction.eventName = String(triggeredEvent.name || '');
      lastAction.eventDescription = String(triggeredEvent.description || '');
    } else {
      lastAction.eventTriggered = false;
    }
    
  G.lastAction = lastAction;
}

const systemMoves = {
  performPartialWaterChange,
  stopFeeding,
  increaseAeration,
  applyConsumable: ({ G }, equipmentType) => {
    const type = String(equipmentType || '');
    const data = equipment[type];
    if (!data || !data.waterEffects) {
      G.error = `Unknown consumable: ${type}`;
      G.lastAction = { type: 'applyConsumable', success: false, reason: 'unknown_consumable', equipmentType: type };
      return;
    }
    const stock = Number(G.equipment?.[type]) || 0;
    if (stock <= 0) {
      G.error = `No ${data.description || type} in inventory`;
      G.lastAction = { type: 'applyConsumable', success: false, reason: 'out_of_stock', equipmentType: type };
      return;
    }

    const { tank, water } = ensureTankAndWaterState(G);
    const eff = data.waterEffects;
    const applied = [];

    if (Number.isFinite(eff.ammoniaDeltaMgL)) {
      water.ammonia = clampNumber((water.ammonia ?? 0) + eff.ammoniaDeltaMgL, 0, 10000);
      applied.push(`ammonia ${eff.ammoniaDeltaMgL > 0 ? '+' : ''}${eff.ammoniaDeltaMgL} ppm`);
    }
    if (Number.isFinite(eff.nitriteDeltaMgL)) {
      water.nitrite = clampNumber((water.nitrite ?? 0) + eff.nitriteDeltaMgL, 0, 10000);
      applied.push(`nitrite ${eff.nitriteDeltaMgL > 0 ? '+' : ''}${eff.nitriteDeltaMgL} ppm`);
    }
    if (Number.isFinite(eff.pHDelta)) {
      water.pH = clampNumber(water.pH + eff.pHDelta, 0, 14);
      applied.push(`pH +${eff.pHDelta}`);
    }
    if (Number.isFinite(eff.calciumDeltaMgL)) {
      water.calcium = clampNumber((water.calcium ?? 0) + eff.calciumDeltaMgL, 0, 10000);
      applied.push(`calcium +${eff.calciumDeltaMgL} mg/L`);
    }
    if (Number.isFinite(eff.potassiumDeltaMgL)) {
      water.potassium = clampNumber((water.potassium ?? 0) + eff.potassiumDeltaMgL, 0, 10000);
      applied.push(`potassium +${eff.potassiumDeltaMgL} mg/L`);
    }
    if (Number.isFinite(eff.ironDeltaMgL)) {
      water.iron = clampNumber((water.iron ?? 0) + eff.ironDeltaMgL, 0, 10000);
      applied.push(`iron +${eff.ironDeltaMgL} mg/L`);
    }
    if (Number.isFinite(eff.dissolvedOxygenDeltaMgL)) {
      water.dissolvedOxygen = clampNumber((water.dissolvedOxygen ?? 0) + eff.dissolvedOxygenDeltaMgL, 0, 15);
      applied.push(`dissolved oxygen +${eff.dissolvedOxygenDeltaMgL} mg/L`);
    }

    if (!G.equipment) G.equipment = {};
    G.equipment[type] = stock - 1;
    G.lastAction = {
      type: 'applyConsumable',
      success: true,
      equipmentType: type,
      applied,
      remaining: stock - 1,
    };
  },

  progressTurn: ({ G }) => {
    console.log('[progressTurn] G.gameTime before:', G.gameTime);
    runOneTurn(G);
    console.log('[progressTurn] G.gameTime after:', G.gameTime);
  },

  progressMultipleTurns: ({ G }, count = 3) => {
    const days = Math.max(1, Math.min(10, Number(count) || 3));
    console.log(`[progressMultipleTurns] advancing ${days} days from day ${G.gameTime}`);
    for (let i = 0; i < days; i++) {
      runOneTurn(G);
    }
    console.log(`[progressMultipleTurns] done, now day ${G.gameTime}`);
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