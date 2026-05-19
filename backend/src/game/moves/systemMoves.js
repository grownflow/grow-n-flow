const { AquaponicsSystem } = require('../models/AquaponicsSystem');
const { EventManager } = require('../utils/EventManager');
const { equipment } = require('../data/equipment');
const { EVENTS, EVENT_TYPES } = require('../data/events');
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
  water.nitrate = clampNumber(water.nitrate ?? 30, 0, 10000);

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
    alerts.push('Ammonia is spiking. Use Stop Feeding immediately, remove any dead fish, and perform a partial water change.');
    if (G && Array.isArray(G.fish) && G.fish.length > 0) {
      const bioEff = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
      if (bioEff >= 0.95) {
        alerts.push(`Biofilter is at maximum efficiency but ammonia is still high — fish load is the bottleneck. Sell one or two fish to reduce waste production, or perform partial water changes every day until ammonia drops below 1.0.`);
      } else if (bioEff >= 0.8) {
        alerts.push(`Apply a biofilter unit to boost processing efficiency (currently ${Math.round(bioEff * 100)}%). If ammonia persists after efficiency reaches 100%, the fish load itself is too high — consider selling a fish.`);
      } else {
        alerts.push(`Biofilter efficiency is low (${Math.round(bioEff * 100)}%). Buy and apply biofilter units to improve the nitrogen cycle.`);
      }
    }
  }

  if (nitrite >= 1.0) {
    alerts.push('Nitrite is rising. Use Stop Feeding, perform a partial water change, and let the biofilter work — nitrite converts to safe nitrate once ammonia input drops.');
    const bioEff = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
    if (bioEff < 0.8) {
      alerts.push(`Biofilter efficiency is ${Math.round(bioEff * 100)}% — apply biofilter units to bring it above 80% so the nitrogen cycle can keep pace with your fish load.`);
    } else if (bioEff >= 0.95 && G && Array.isArray(G.fish) && G.fish.length > 0) {
      alerts.push(`Biofilter is nearly maxed (${Math.round(bioEff * 100)}%) — buying more won't help much. Reduce fish biomass by selling a fish, or do partial water changes daily until nitrite drops.`);
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

  // Starvation warning — fires before the fatal day-5 threshold so the player can act.
  if (G && Array.isArray(G.fish) && G.fish.length > 0) {
    const maxDaysUnfed = Math.max(...G.fish.map(f => Number(f.daysWithoutFood) || 0));
    if (maxDaysUnfed >= 3) {
      alerts.push(`Fish have not eaten in ${maxDaysUnfed} day(s). Add food to the tank immediately — fish will begin dying on day 5 without food.`);
    }
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
    if (!plant) continue; // skip null/undefined entries

    // Ensure health is a valid number; missing health = treat as full.
    if (!Number.isFinite(Number(plant.health))) plant.health = 10;

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
    } else if (Number(plant.health) > 0) {
      // Only recover if already alive — a plant at 0 health should not be
      // resurrected by good conditions on the same turn it was dealt fatal damage.
      plant.health = clampNumber(Number(plant.health) + 0.15, 0, 10);
    }

    if (plant.health <= 0) {
      plantDeaths.push({ id: String(plant.id ?? ''), type: String(plant.type ?? ''), age: Number(plant.age ?? 0) });
      plant._dead = true;
    }
  }

  if (plantDeaths.length > 0) {
    // Null-safe filter: also drops any unexpected null/undefined entries.
    G.plants = G.plants.filter((plant) => plant && !plant._dead);
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

    // Waste load: ammonia up (from feeding + passive metabolism), oxygen down.
    const fishAmmoniaRate = clampNumber(Number(fish.ammoniaProductionRate ?? species.ammoniaProductionRate ?? 0.1), 0, 10);
    // Feeding waste (scaled to produce meaningful ammonia relative to plant uptake)
    const ammoniaDelta = portion * (0.25 + 0.15 * fishAmmoniaRate)
      // Passive metabolic excretion — fish produce ammonia even when unfed
      + fishAmmoniaRate * 0.15;
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
  const k = 0.80 * eff * circulationMult * circEff * oxygenFactor; // fraction converted per day

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

function runOneTurn(G, { skipPromotion = false } = {}) {
  const { tank, water } = ensureTankAndWaterState(G);

    // Promote a pending technical event to active — the player had at least one
    // full turn to see the warning and take action before effects begin.
    // skipPromotion is set when called from progressMultipleTurns for events that
    // were detected DURING the current batch (not before it), ensuring the player
    // always gets a genuine reaction window before effects apply.
    if (!skipPromotion && G.pendingEvent && !G.activeEvent) {
      EventManager.promoteToActive(G);
    }

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

    // Natural dissolved-oxygen replenishment through surface agitation and circulation.
    // Without this, oxygen only decreased (fish respiration) and never recovered.
    const circulationStopped = Boolean(G.eventEffects?.circulationStopped);
    if (!circulationStopped) {
      const circEff = clampNumber(tank.circulationEfficiency ?? 1.0, 0, 2.0);
      const saturatedDO = 8.0; // mg/L at ~25 °C
      const deficit = Math.max(0, saturatedDO - Number(water.dissolvedOxygen));
      water.dissolvedOxygen = clampNumber(
        Number(water.dissolvedOxygen) + deficit * 0.25 * circEff,
        0, saturatedDO
      );
    }

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
    
    // Check for new random events.
    // TECHNICAL events are stored as G.pendingEvent — the player sees a warning
    // this turn and effects apply on the NEXT progress.
    // SOCIAL events (money bonus etc.) fire immediately — nothing harmful to prepare for.
    const detectedEventDef = EventManager.checkForRandomEvent(G);
    if (detectedEventDef) {
      if (detectedEventDef.type === EVENT_TYPES.TECHNICAL) {
        G.pendingEvent = {
          id:          String(detectedEventDef.id),
          type:        String(detectedEventDef.type),
          name:        String(detectedEventDef.name),
          description: String(detectedEventDef.description),
          cause:       String(detectedEventDef.cause || ''),
          effects:     JSON.parse(JSON.stringify(detectedEventDef.effects || {})),
          duration:    Number(detectedEventDef.duration),
          severity:    String(detectedEventDef.severity),
          ...(detectedEventDef.repairCost !== undefined
            ? { repairCost: Number(detectedEventDef.repairCost) }
            : {}),
          detectedAt: Number(G.gameTime),
        };
        console.log(`[progressTurn] UPCOMING technical event: "${detectedEventDef.name}" (player has 1 turn to prepare)`);
      } else {
        // Social events: trigger and apply immediately
        EventManager.triggerEvent(G, detectedEventDef.id);
        EventManager.applyEventEffects(G);
        console.log(`[progressTurn] SOCIAL event fired immediately: "${detectedEventDef.name}"`);
      }
    }

    if (G.activeEvent) {
      console.log(`[progressTurn] Active event: "${G.activeEvent.name}" - ${G.activeEvent.turnsRemaining} turns remaining`);
    }

    // Progress active event duration (decrements turnsRemaining, clears at 0)
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
    if (detectedEventDef) {
      lastAction.eventTriggered  = true;
      lastAction.eventPending    = detectedEventDef.type === EVENT_TYPES.TECHNICAL;
      lastAction.eventName       = String(detectedEventDef.name || '');
      lastAction.eventDescription = String(detectedEventDef.description || '');
      lastAction.eventSeverity   = String(detectedEventDef.severity || '');
    } else {
      lastAction.eventTriggered  = false;
      lastAction.eventPending    = false;
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

    // Permanent biofilter efficiency boost — applied once per unit consumed.
    if (Number.isFinite(data.biofilterEfficiencyBoost) && data.biofilterEfficiencyBoost > 0) {
      const boost = Number(data.biofilterEfficiencyBoost);
      const current = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
      const next = clampNumber(current + boost, 0, 1);
      if (next > current) {
        tank.biofilterEfficiency = next;
        applied.push(`biofilter efficiency ${current.toFixed(2)} → ${next.toFixed(2)}`);
      } else {
        applied.push('biofilter efficiency already at maximum (100%)');
      }
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

    // Track which pending event existed BEFORE this batch so we know which ones
    // were detected DURING the batch. Events detected mid-batch stay pending until
    // the player's NEXT action — they should never be silently activated within
    // the same "Progress 3 Days" press that first showed the warning.
    const pendingEventIdBeforeBatch = G.pendingEvent?.id ?? null;

    const allFishDeaths = [];
    const allPlantDeaths = [];
    const waterSnapshots = [];

    for (let i = 0; i < days; i++) {
      // Days 2+ of a multi-day progress: auto-feed fish from inventory so players
      // don't have to manually re-feed between turns when using "Progress 3 Days".
      // Day 1 uses whatever the player manually put in the tank before pressing the button.
      if (i > 0 && Array.isArray(G.fish) && G.fish.length > 0 && Number(G.fishFood) > 0) {
        const tank = G.aquaponicsSystem?.tank;
        if (tank) {
          const dailyNeed = G.fish.reduce((sum, fish) => {
            const sk = String(fish?.type || '').toLowerCase();
            const sp = fishSpecies[sk] || fishSpecies.tilapia;
            return sum + clampNumber(fish.foodConsumptionRate ?? sp.foodConsumptionRate ?? 0.2, 0.05, 10);
          }, 0);
          const feedAmt = Math.min(Math.ceil(dailyNeed), Number(G.fishFood));
          if (feedAmt > 0) {
            tank.foodInTank = clampNumber((tank.foodInTank || 0) + feedAmt, 0, 1e9);
            G.fishFood = Math.max(0, G.fishFood - feedAmt);
          }
        }
      }

      // Only promote a pending event if it existed BEFORE this batch started.
      // A pending event detected on day 1 of a 3-day press must NOT be promoted
      // on day 2 of that same press — the player hasn't had a chance to react yet.
      const skipPromotion = G.pendingEvent?.id !== pendingEventIdBeforeBatch;
      runOneTurn(G, { skipPromotion });

      // Accumulate deaths from each day before lastAction is overwritten
      const dayFishDeaths = Array.isArray(G.lastAction?.fishDeaths) ? G.lastAction.fishDeaths : [];
      const dayPlantDeaths = Array.isArray(G.lastAction?.plantDeaths) ? G.lastAction.plantDeaths : [];
      allFishDeaths.push(...dayFishDeaths);
      allPlantDeaths.push(...dayPlantDeaths);

      // Snapshot water state for this day so matchHandler can persist one reading per day
      const w = G.aquaponicsSystem?.tank?.water;
      const t = G.aquaponicsSystem?.tank;
      if (w) {
        waterSnapshots.push({
          gameTime: G.gameTime,
          water: {
            ammonia:         Number(w.ammonia         ?? 0),
            nitrite:         Number(w.nitrite         ?? 0),
            nitrate:         Number(w.nitrate         ?? 0),
            pH:              Number(w.pH              ?? 7),
            temperature:     Number(w.temperature     ?? 25),
            dissolvedOxygen: Number(w.dissolvedOxygen ?? 8),
            phosphorus:      Number(w.phosphorus      ?? 0),
            potassium:       Number(w.potassium       ?? 0),
            calcium:         Number(w.calcium         ?? 0),
            magnesium:       Number(w.magnesium       ?? 0),
            iron:            Number(w.iron            ?? 0),
          },
          tank: {
            capacity:            Number(t?.capacity ?? t?.volumeLiters ?? 1000),
            currentVolume:       Number(t?.currentVolume ?? t?.currentWaterLevel ?? 0),
            biofilterEfficiency: Number(t?.biofilterEfficiency ?? 0.8),
          },
          fishDeaths:  dayFishDeaths.length,
          plantDeaths: dayPlantDeaths.length,
          event: G.activeEvent
            ? { id: String(G.activeEvent.id), type: String(G.activeEvent.type), severity: String(G.activeEvent.severity) }
            : null,
        });
      }
    }

    // Merge accumulated deaths and per-day snapshots back onto the final lastAction
    if (G.lastAction) {
      G.lastAction.fishDeaths     = allFishDeaths;
      G.lastAction.plantDeaths    = allPlantDeaths;
      G.lastAction.waterSnapshots = waterSnapshots;

      // If a technical event is pending at the END of the batch (detected on the
      // last day), make sure the notification reflects it correctly.
      if (G.pendingEvent) {
        G.lastAction.eventTriggered   = true;
        G.lastAction.eventPending     = true;
        G.lastAction.eventName        = String(G.pendingEvent.name || '');
        G.lastAction.eventDescription = String(G.pendingEvent.description || '');
        G.lastAction.eventSeverity    = String(G.pendingEvent.severity || '');
      }
    }

    console.log(`[progressMultipleTurns] done, now day ${G.gameTime}. fishDeaths=${allFishDeaths.length} plantDeaths=${allPlantDeaths.length}`);
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
      const tank = G.aquaponicsSystem.tank;
      const cap = Number(tank.capacity || tank.volumeLiters || 1000);
      const currentVol = clampNumber(tank.currentVolume ?? tank.currentWaterLevel ?? cap, 0, cap);

      // Refilling dilutes dissolved pollutants proportional to the fresh-water added.
      // Example: 200 L remaining with ammonia 2.0 mg/L → after refill to 1000 L → 0.4 mg/L.
      if (currentVol < cap && currentVol >= 0 && tank.water) {
        const dilution = currentVol / cap; // fraction of old water remaining
        const w = tank.water;
        w.ammonia   = clampNumber(Number(w.ammonia   ?? 0) * dilution, 0, 1000);
        w.nitrite   = clampNumber(Number(w.nitrite   ?? 0) * dilution, 0, 1000);
        w.nitrate   = clampNumber(Number(w.nitrate   ?? 0) * dilution, 0, 10000);
        w.potassium = clampNumber(Number(w.potassium ?? 0) * dilution, 0, 10000);
        w.calcium   = clampNumber(Number(w.calcium   ?? 0) * dilution, 0, 10000);
        w.phosphorus= clampNumber(Number(w.phosphorus?? 0) * dilution, 0, 10000);
        w.magnesium = clampNumber(Number(w.magnesium ?? 0) * dilution, 0, 10000);
        w.iron      = clampNumber(Number(w.iron      ?? 0) * dilution, 0, 10000);
        // Fresh water is well-oxygenated; top up toward 8 mg/L.
        w.dissolvedOxygen = clampNumber(
          Number(w.dissolvedOxygen ?? 8) * dilution + 8 * (1 - dilution),
          0, 20
        );
      }

      tank.capacity = cap;
      tank.volumeLiters = cap;
      tank.currentWaterLevel = cap;
      tank.currentVolume = cap;
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