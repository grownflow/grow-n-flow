// Bot strategy implementations.
//
// Each strategy overrides checkPurchases (and optionally handleCriticalIssues /
// checkWaterChemistry) to express a distinct playstyle.  All move names and
// argument shapes must match the actual move implementations in src/game/moves/.
//
// Valid fish types:  'tilapia', 'barramundi', 'catfish'
// Valid plant types: 'Basil', 'ParrisIslandRomaine', 'Rosemary', 'Tomato', 'Pepper'
// Valid equipment:   'fishFood', 'biofilter', 'aerationStones',
//                    'bufferingSolutionCalciumCarbonate',
//                    'bufferingSolutionPotassiumCarbonate',
//                    'chelatedIronDTPA11', 'growLight', 'waterPump'

const { Bot } = require('./Bot');

// Must stay in sync with systemMoves.js BASE_BIOFILTER_CAPACITY = 2.5
const BASE_BIOFILTER_CAPACITY = 2.5;

/**
 * Estimate biofilter load as a fraction of capacity (0 = empty, 1 = full,
 * >1 = over capacity).  Formula mirrors estimateDailyAmmoniaLoad() in
 * systemMoves.js so the bot's perception matches the backend's reality.
 */
function biofilterLoadFraction(G) {
  const fish = G.fish || [];
  if (fish.length === 0) return 0;
  const bioEff   = Number(G.aquaponicsSystem?.tank?.biofilterEfficiency ?? 0.8);
  const capacity = BASE_BIOFILTER_CAPACITY * bioEff;
  let load = 0;
  for (const f of fish) {
    const rate = Number(f.ammoniaProductionRate ?? 0.1);
    const fcr  = Number(f.foodConsumptionRate   ?? 0.2);
    load += fcr * (0.25 + 0.15 * rate) + rate * 1.0;
  }
  return capacity > 0 ? load / capacity : Infinity;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSERVATIVE
// Playstyle: cautious growth, proactive water management, immediate repairs.
// Keeps a large money buffer; only stocks tilapia; upgrades biofilter early;
// responds to water issues before they reach danger thresholds.
// ─────────────────────────────────────────────────────────────────────────────
class ConservativeBot extends Bot {
  constructor(config = {}) {
    super('conservative', {
      riskTolerance:  0.2,
      minMoneyBuffer: 200,
      maxFish:        5,
      maxPlants:      20,
      ...config,
    });
  }

  // Repair any event as soon as affordable; fall back to quick repair when cash is tight.
  handleCriticalIssues(G, ctx) {
    const ev = G.activeEvent;
    if (ev?.repairCost) {
      if (G.money >= ev.repairCost + this.config.minMoneyBuffer) {
        return { moveName: 'repairSystem', args: [] };
      }
      if (ev.quickRepairCost && G.money >= ev.quickRepairCost + this.config.minMoneyBuffer) {
        return { moveName: 'quickRepairSystem', args: [] };
      }
    }
    // Stop feeding immediately when ammonia is at critical level.
    const water = G.aquaponicsSystem?.tank?.water;
    const tank  = G.aquaponicsSystem?.tank;
    if (water && Number(water.ammonia) >= 2.0 && Number(tank?.foodInTank || 0) > 0) {
      return { moveName: 'stopFeeding', args: [] };
    }
    return null;
  }

  checkWaterChemistry(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water;
    if (!water) return null;
    const ammonia = Number(water.ammonia        || 0);
    const do_     = Number(water.dissolvedOxygen || 8);
    const iron    = Number(water.iron            || 2);

    // Low DO — apply stone or buy a pack, then fall back to free aeration.
    if (do_ < 4.5) {
      const stock = Number(G.equipment?.aerationStones) || 0;
      if (stock > 0) return { moveName: 'applyConsumable', args: ['aerationStones'] };
      if (G.money >= 25 + this.config.minMoneyBuffer) {
        return { moveName: 'buyEquipment', args: ['aerationStones', 1] };
      }
      return { moveName: 'increaseAeration', args: [] };
    }

    // Elevated ammonia — apply biofilter from inventory first.
    if (ammonia >= 0.5) {
      const bioStock = Number(G.equipment?.biofilter) || 0;
      if (bioStock > 0) return { moveName: 'applyConsumable', args: ['biofilter'] };
    }

    // Partial water change once ammonia crosses 1.0.
    if (ammonia >= 1.0) {
      return { moveName: 'performPartialWaterChange', args: [] };
    }

    // Low iron — apply chelated iron if stocked.
    if (iron < 1.0) {
      const ironStock = Number(G.equipment?.chelatedIronDTPA11) || 0;
      if (ironStock > 0) return { moveName: 'applyConsumable', args: ['chelatedIronDTPA11'] };
    }

    return null;
  }

  checkPurchases(G, ctx) {
    const available  = G.money - this.config.minMoneyBuffer;
    if (available < 5) return null;

    const fishCount  = (G.fish   || []).length;
    const plantCount = (G.plants || []).length;
    const load       = biofilterLoadFraction(G);

    // Proactively upgrade biofilter at 70 % load — buy one at a time.
    const bioStock = Number(G.equipment?.biofilter) || 0;
    const bioEff   = Number(G.aquaponicsSystem?.tank?.biofilterEfficiency ?? 0.8);
    if (load >= 0.7 && bioStock === 0 && bioEff < 0.98 && available >= 120) {
      return { moveName: 'buyEquipment', args: ['biofilter', 1] };
    }

    // Stock tilapia (cheap, hardy) up to target.
    if (fishCount < this.config.maxFish && load < 0.8) {
      const qty = Math.min(2, this.config.maxFish - fishCount);
      if (available >= 2.50 * qty) {
        return { moveName: 'addFish', args: ['tilapia', qty] };
      }
    }

    // Fill plant beds: Basil for first 10 slots (fastest ROI), then Romaine.
    if (plantCount < this.config.maxPlants) {
      const plantType = plantCount < 10 ? 'Basil' : 'ParrisIslandRomaine';
      const seedCost  = plantType === 'Basil' ? 0.25 : 0.30;
      const openSlots = this.config.maxPlants - plantCount;
      const qty       = Math.min(openSlots, Math.floor(available / seedCost), 10);
      if (qty >= 2) {
        return { moveName: 'plantSeedsBulk', args: [plantType, qty, 140] };
      }
    }

    // Keep a reserve of aeration stones (min 5).
    const aerStock = Number(G.equipment?.aerationStones) || 0;
    if (aerStock < 5 && available >= 25) {
      return { moveName: 'buyEquipment', args: ['aerationStones', 1] };
    }

    // Keep buffering solution on hand (min 2).
    const caBuffer = Number(G.equipment?.bufferingSolutionCalciumCarbonate) || 0;
    if (caBuffer < 2 && available >= 30) {
      return { moveName: 'buyEquipment', args: ['bufferingSolutionCalciumCarbonate', 2] };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGGRESSIVE
// Playstyle: maximise stock and plant count as fast as possible; react to
// problems only when critical; prioritise revenue over water quality margins.
// ─────────────────────────────────────────────────────────────────────────────
class AggressiveBot extends Bot {
  constructor(config = {}) {
    super('aggressive', {
      riskTolerance:  0.9,
      minMoneyBuffer: 50,
      maxFish:        15,
      maxPlants:      60,
      ...config,
    });
  }

  // Repair pump failure immediately; use quick repair as cash-poor fallback.
  // Lower-priority events wait until cash is flush.
  handleCriticalIssues(G, ctx) {
    const ev = G.activeEvent;
    if (ev?.repairCost) {
      const isPump = ev.id === 'pumpFailure';
      if (isPump && G.money >= ev.repairCost) {
        return { moveName: 'repairSystem', args: [] };
      }
      if (isPump && ev.quickRepairCost && G.money >= ev.quickRepairCost) {
        return { moveName: 'quickRepairSystem', args: [] };
      }
      // Other events: repair when comfortably flush
      if (!isPump && G.money >= ev.repairCost + 100) {
        return { moveName: 'repairSystem', args: [] };
      }
    }
    // Emergency water change only at truly critical ammonia.
    const water = G.aquaponicsSystem?.tank?.water;
    if (water && Number(water.ammonia) >= 2.0) {
      return { moveName: 'performPartialWaterChange', args: [] };
    }
    return null;
  }

  checkWaterChemistry(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water;
    if (!water) return null;
    const ammonia = Number(water.ammonia        || 0);
    const do_     = Number(water.dissolvedOxygen || 8);

    // Only act on critically low DO.
    if (do_ <= 4.0) {
      const stock = Number(G.equipment?.aerationStones) || 0;
      if (stock > 0) return { moveName: 'applyConsumable', args: ['aerationStones'] };
      return { moveName: 'increaseAeration', args: [] };
    }

    // Reactive biofilter: apply from inventory when ammonia is already high.
    if (ammonia >= 1.5) {
      const bioStock = Number(G.equipment?.biofilter) || 0;
      if (bioStock > 0) return { moveName: 'applyConsumable', args: ['biofilter'] };
      // Buy one only if ammonia is near-danger and cash is available.
      if (ammonia >= 2.0 && G.money >= 120) {
        return { moveName: 'buyEquipment', args: ['biofilter', 1] };
      }
    }

    return null;
  }

  checkPurchases(G, ctx) {
    const available  = G.money - this.config.minMoneyBuffer;
    if (available < 10) return null;

    const fishCount  = (G.fish   || []).length;
    const plantCount = (G.plants || []).length;
    const load       = biofilterLoadFraction(G);

    // Wait until day 7 before stocking: the 7-day grace period means there's no
    // rush, and the biofilter needs time to begin establishing (55% → climbing to 80%).
    // Cap at 85% load so the system doesn't immediately overcapacity during cycling.
    if (fishCount < this.config.maxFish && load < 0.85 && G.gameTime >= 7) {
      if (available >= 6.00) {
        const qty = Math.min(3, Math.floor(available / 6.00), this.config.maxFish - fishCount);
        if (qty >= 1) return { moveName: 'addFish', args: ['barramundi', qty] };
      }
      if (available >= 2.50) {
        const qty = Math.min(5, Math.floor(available / 2.50), this.config.maxFish - fishCount);
        if (qty >= 1) return { moveName: 'addFish', args: ['tilapia', qty] };
      }
    }

    // Fill plant beds with Basil (fastest turnover at 5 days / $2.50).
    if (plantCount < this.config.maxPlants) {
      const openSlots = this.config.maxPlants - plantCount;
      const qty       = Math.min(openSlots, Math.floor(available / 0.25), 20);
      if (qty >= 5) {
        return { moveName: 'plantSeedsBulk', args: ['Basil', qty, 140] };
      }
    }

    // Repair lower-priority events once flush with cash.
    const ev = G.activeEvent;
    if (ev?.repairCost && G.money >= ev.repairCost + 100) {
      return { moveName: 'repairSystem', args: [] };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCED
// Playstyle: steady growth across fish and plants; maintains water quality
// margins; mixes species for diversified revenue.
// ─────────────────────────────────────────────────────────────────────────────
class BalancedBot extends Bot {
  constructor(config = {}) {
    super('balanced', {
      riskTolerance:   0.5,
      minMoneyBuffer:  150,
      maxTilapia:      8,
      maxBarramundi:   3,
      maxPlants:       30,
      ...config,
    });
  }

  handleCriticalIssues(G, ctx) {
    const ev = G.activeEvent;
    if (ev?.repairCost) {
      if (G.money >= ev.repairCost + this.config.minMoneyBuffer) {
        return { moveName: 'repairSystem', args: [] };
      }
      if (ev.quickRepairCost && G.money >= ev.quickRepairCost + this.config.minMoneyBuffer) {
        return { moveName: 'quickRepairSystem', args: [] };
      }
    }
    return null;
  }

  checkWaterChemistry(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water;
    if (!water) return null;
    const ammonia = Number(water.ammonia        || 0);
    const do_     = Number(water.dissolvedOxygen || 8);
    const pH      = Number(water.pH              || 7);

    // DO response at a slightly higher threshold than the base class.
    if (do_ < 5.0) {
      const stock = Number(G.equipment?.aerationStones) || 0;
      if (stock > 0) return { moveName: 'applyConsumable', args: ['aerationStones'] };
      if (G.money >= 25 + this.config.minMoneyBuffer) {
        return { moveName: 'buyEquipment', args: ['aerationStones', 1] };
      }
      return { moveName: 'increaseAeration', args: [] };
    }

    // Apply biofilter from inventory before ammonia crosses 1.0.
    if (ammonia >= 0.8) {
      const bioStock = Number(G.equipment?.biofilter) || 0;
      if (bioStock > 0) return { moveName: 'applyConsumable', args: ['biofilter'] };
    }

    // Partial water change once ammonia reaches warning level.
    if (ammonia >= 1.0) {
      return { moveName: 'performPartialWaterChange', args: [] };
    }

    // pH correction with buffering solution.
    if (pH < 6.5) {
      const caBuffer = Number(G.equipment?.bufferingSolutionCalciumCarbonate) || 0;
      if (caBuffer > 0) {
        return { moveName: 'applyConsumable', args: ['bufferingSolutionCalciumCarbonate'] };
      }
    }

    return null;
  }

  checkPurchases(G, ctx) {
    const available    = G.money - this.config.minMoneyBuffer;
    if (available < 5) return null;

    const tilapiaCount = (G.fish || []).filter(f => f.type === 'tilapia').length;
    const barraCount   = (G.fish || []).filter(f => f.type === 'barramundi').length;
    const plantCount   = (G.plants || []).length;
    const load         = biofilterLoadFraction(G);

    // Buy a biofilter unit when load is high, stock is empty, and efficiency
    // still has room to grow.  One at a time to avoid over-spending.
    const bioStock = Number(G.equipment?.biofilter) || 0;
    const bioEff   = Number(G.aquaponicsSystem?.tank?.biofilterEfficiency ?? 0.8);
    if (load >= 0.85 && bioStock === 0 && bioEff < 0.98 && available >= 120) {
      return { moveName: 'buyEquipment', args: ['biofilter', 1] };
    }

    // Build tilapia base before adding barramundi.
    if (tilapiaCount < this.config.maxTilapia && load < 0.85) {
      const qty = Math.min(2, this.config.maxTilapia - tilapiaCount);
      if (available >= 2.50 * qty) {
        return { moveName: 'addFish', args: ['tilapia', qty] };
      }
    }

    // Add barramundi once tilapia base is established (≥ 4).
    if (tilapiaCount >= 4 && barraCount < this.config.maxBarramundi && load < 0.85) {
      if (available >= 6.00) {
        return { moveName: 'addFish', args: ['barramundi', 1] };
      }
    }

    // Mixed planting: alternate Basil batches and Romaine batches.
    if (plantCount < this.config.maxPlants) {
      const openSlots = this.config.maxPlants - plantCount;
      // Every 10 plants, switch species for diversity.
      const plantType = Math.floor(plantCount / 10) % 2 === 0
        ? 'Basil'
        : 'ParrisIslandRomaine';
      const seedCost  = plantType === 'Basil' ? 0.25 : 0.30;
      const qty       = Math.min(openSlots, Math.floor(available / seedCost), 10);
      if (qty >= 3) {
        return { moveName: 'plantSeedsBulk', args: [plantType, qty, 140] };
      }
    }

    // Keep buffering solution stocked (min 2) for pH events.
    const caBuffer = Number(G.equipment?.bufferingSolutionCalciumCarbonate) || 0;
    if (caBuffer < 2 && available >= 30) {
      return { moveName: 'buyEquipment', args: ['bufferingSolutionCalciumCarbonate', 2] };
    }

    // Buy heater/chiller once biofilter is mature and system is established.
    const hasTC = Number(G.equipment?.heaterChiller || 0) > 0;
    if (!hasTC && G.gameTime >= 14 && available >= 150) {
      return { moveName: 'buyEquipment', args: ['heaterChiller', 1] };
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVE
// Playstyle: models a new/confused player who only acts in response to alerts.
// Delays almost every purchase; repairs only when forced; plants and stocks fish
// slowly; useful as a baseline for "what happens without proactive management".
// ─────────────────────────────────────────────────────────────────────────────
class ReactiveBot extends Bot {
  constructor(config = {}) {
    super('reactive', {
      riskTolerance:  0.3,
      minMoneyBuffer: 50,
      maxFish:        5,
      maxPlants:      10,
      ...config,
    });
  }

  // Repairs only when the repair cost is less than 10 % of current money
  // (i.e., very comfortably affordable) or when water leak is near-fatal.
  handleCriticalIssues(G, ctx) {
    const ev = G.activeEvent;
    if (ev?.repairCost) {
      const waterLeak = ev.id === 'waterLeak';
      const tank = G.aquaponicsSystem?.tank;
      const criticalLeak = waterLeak &&
        (Number(tank?.currentVolume || 1000) / Number(tank?.capacity || 1000)) < 0.4;

      if (criticalLeak && G.money >= ev.repairCost) {
        return { moveName: 'repairSystem', args: [] };
      }
      // Quick repair for critical leak when can't afford full
      if (criticalLeak && ev.quickRepairCost && G.money >= ev.quickRepairCost) {
        return { moveName: 'quickRepairSystem', args: [] };
      }
      if (!waterLeak && G.money >= ev.repairCost * 3) {
        return { moveName: 'repairSystem', args: [] };
      }
    }
    return null;
  }

  // Reacts to issues only when they are already at the danger threshold.
  checkWaterChemistry(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water;
    if (!water) return null;
    const ammonia = Number(water.ammonia        || 0);
    const do_     = Number(water.dissolvedOxygen || 8);

    // Critical DO only.
    if (do_ < 4.0) {
      const stock = Number(G.equipment?.aerationStones) || 0;
      if (stock > 0) return { moveName: 'applyConsumable', args: ['aerationStones'] };
      return { moveName: 'increaseAeration', args: [] };
    }

    // Biofilter only at dangerous ammonia — reactive, not proactive.
    if (ammonia >= 1.5) {
      const bioStock = Number(G.equipment?.biofilter) || 0;
      if (bioStock > 0) return { moveName: 'applyConsumable', args: ['biofilter'] };
    }

    if (ammonia >= 2.0) {
      return { moveName: 'performPartialWaterChange', args: [] };
    }

    return null;
  }

  checkPurchases(G, ctx) {
    const available  = G.money - this.config.minMoneyBuffer;
    if (available < 50) return null; // high threshold — slow to spend

    const fishCount  = (G.fish   || []).length;
    const plantCount = (G.plants || []).length;
    const load       = biofilterLoadFraction(G);

    // Buy fish slowly; wait until ammonia is low.
    if (fishCount < this.config.maxFish && load < 0.6 && available >= 100) {
      return { moveName: 'addFish', args: ['tilapia', 1] };
    }

    // Plant a small batch only when cash is comfortable.
    if (plantCount < this.config.maxPlants && available >= 80) {
      const qty = Math.min(3, this.config.maxPlants - plantCount);
      return { moveName: 'plantSeedsBulk', args: ['ParrisIslandRomaine', qty, 140] };
    }

    return null;
  }

  // Override feeding: buy food only when completely out.
  checkFeeding(G, ctx) {
    if (!G.fish || G.fish.length === 0) return null;
    const foodUnits = Number(G.fishFood) || 0;
    if (foodUnits === 0 && G.money >= 20) {
      return { moveName: 'buyEquipment', args: ['fishFood', 1] };
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────
function createBot(strategyName, config = {}) {
  switch (String(strategyName).toLowerCase()) {
    case 'conservative': return new ConservativeBot(config);
    case 'aggressive':   return new AggressiveBot(config);
    case 'balanced':     return new BalancedBot(config);
    case 'reactive':     return new ReactiveBot(config);
    default:
      throw new Error(
        `Unknown strategy: "${strategyName}". ` +
        `Available: conservative, aggressive, balanced, reactive`
      );
  }
}

module.exports = {
  ConservativeBot,
  AggressiveBot,
  BalancedBot,
  ReactiveBot,
  createBot,
};
