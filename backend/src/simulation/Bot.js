// Base bot class.  Subclasses override checkPurchases (and optionally
// checkWaterChemistry / handleCriticalIssues) to express a strategy.
//
// Decision pipeline per day (highest priority first):
//   handleCriticalIssues → checkWaterChemistry → checkHarvests
//   → checkPurchases → checkFeeding → null (= progress day)
//
// IMPORTANT: all moves follow the boardgame.io signature
//   move({ G, ctx }, ...args)
// They mutate G in place and return nothing.  executeMove therefore
// calls the move function for its side-effects and returns the same G
// reference, which the SimulationRunner does NOT need to reassign.

const moves = require('../game/moves');

class Bot {
  constructor(strategy = 'balanced', config = {}) {
    this.strategy = strategy;
    this.config = {
      riskTolerance:   config.riskTolerance   ?? 0.5,
      minMoneyBuffer:  config.minMoneyBuffer  ?? 100,
      verbose:         config.verbose         ?? false,
      ...config,
    };
    this.moveHistory = [];
  }

  // ── Main decision entry point ──────────────────────────────────────────────

  async makeDecision(G, ctx) {
    const criticalMove = this.handleCriticalIssues(G, ctx);
    if (criticalMove) return criticalMove;

    const waterMove = this.checkWaterChemistry(G, ctx);
    if (waterMove) return waterMove;

    const harvestMove = this.checkHarvests(G, ctx);
    if (harvestMove) return harvestMove;

    const purchaseMove = this.checkPurchases(G, ctx);
    if (purchaseMove) return purchaseMove;

    const feedMove = this.checkFeeding(G, ctx);
    if (feedMove) return feedMove;

    return null; // signal SimulationRunner to advance the day
  }

  // ── Decision layers (override in subclasses) ───────────────────────────────

  // Repair system damage and respond to critical water chemistry.
  handleCriticalIssues(G, ctx) {
    const ev = G.activeEvent;
    if (ev?.repairCost && ev.severity === 'high') {
      if (G.money >= ev.repairCost + this.config.minMoneyBuffer) {
        return { moveName: 'repairSystem', args: [] };
      }
    }
    return null;
  }

  // Respond to water chemistry issues — override for strategy-specific thresholds.
  checkWaterChemistry(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water;
    const tank  = G.aquaponicsSystem?.tank;
    if (!water) return null;

    const do_ = Number(water.dissolvedOxygen || 8);

    if (do_ < 4.0) {
      const stock = Number(G.equipment?.aerationStones) || 0;
      if (stock > 0) return { moveName: 'applyConsumable', args: ['aerationStones'] };
      return { moveName: 'increaseAeration', args: [] };
    }

    // Apply any stocked biofilter units proactively while efficiency is below 80%.
    // Bots buy biofilters as reserves but only get the benefit once they are applied.
    const bioStock = Number(G.equipment?.biofilter) || 0;
    const bioEff   = Number(tank?.biofilterEfficiency ?? 0.8);
    if (bioStock > 0 && bioEff < 0.80) {
      return { moveName: 'applyConsumable', args: ['biofilter'] };
    }

    return null;
  }

  // Harvest mature plants → sell produce inventory → sell harvestable fish.
  // Returns only one action per call; the decision loop cycles until nothing
  // is harvestable.
  checkHarvests(G, ctx) {
    // 1. Harvest all mature plants into inventory in one action.
    const maturePlants = (G.plants || []).filter(p => p.growthStage === 'mature');
    if (maturePlants.length > 0) {
      return { moveName: 'harvestAllMaturePlants', args: [] };
    }

    // 2. Sell any produce currently sitting in inventory.
    const produce = G.inventory?.produce || {};
    for (const [type, entry] of Object.entries(produce)) {
      if ((entry?.count || 0) > 0) {
        return { moveName: 'sellProducts', args: [type] };
      }
    }

    // 3. Sell the first harvestable fish (≥ 80% of harvest weight).
    //    Selling one at a time lets the decision loop continue correctly.
    const harvestable = (G.fish || []).filter(
      f => Number(f.weight) >= Number(f.harvestWeight || 800) * 0.8
    );
    if (harvestable.length > 0) {
      return { moveName: 'sellFish', args: [harvestable[0].id] };
    }

    return null;
  }

  // Override in subclasses to buy fish, plants, equipment.
  checkPurchases(G, ctx) {
    return null;
  }

  // Ensure the fish-food inventory stays ahead of auto-feed demand.
  // Auto-feed draws from G.fishFood before each simulated day, so the bot
  // only needs to restock rather than explicitly call feedFish.
  checkFeeding(G, ctx) {
    if (!G.fish || G.fish.length === 0) return null;

    const foodUnits  = Number(G.fishFood) || 0;
    const dailyNeed  = G.fish.reduce(
      (sum, f) => sum + (Number(f.foodConsumptionRate) || 0.2), 0
    );

    // Keep at least 5 days of food stocked.
    if (foodUnits < dailyNeed * 5) {
      if (G.money >= 20 + this.config.minMoneyBuffer) {
        return { moveName: 'buyEquipment', args: ['fishFood', 1] };
      }
    }
    return null;
  }

  // ── Move execution ─────────────────────────────────────────────────────────

  // Calls the move with boardgame.io's ({ G, ctx }, ...args) signature.
  // G is mutated in place; the returned value (always undefined for these
  // moves) is ignored.  We return G so SimulationRunner's
  //   G = await bot.executeMove(...)
  // pattern stays valid even though G never changes reference.
  async executeMove(G, ctx, moveName, args) {
    const move = moves[moveName];
    if (!move) {
      if (this.config.verbose) {
        console.warn(`[Bot:${this.strategy}] Unknown move: ${moveName}`);
      }
      return G;
    }

    // Move functions print diagnostics to console.log.  Suppress them in
    // non-verbose mode so batch runs don't produce hundreds of MB of output.
    if (!this.config.verbose) {
      const noop = () => {};
      const saved = console.log;
      console.log = noop;
      try { move({ G, ctx }, ...(args || [])); } finally { console.log = saved; }
    } else {
      move({ G, ctx }, ...(args || []));
    }

    const success = G.lastAction?.success !== false && !G.error;

    this.moveHistory.push({
      day:     G.gameTime,
      move:    moveName,
      args:    args || [],
      success,
      error:   G.error || null,
    });

    if (this.config.verbose) {
      const a = (args || []).map(x => JSON.stringify(x)).join(', ');
      const ok = success ? 'ok' : `FAILED (${G.error || G.lastAction?.reason || '?'})`;
      console.log(`  [Bot:${this.strategy}] day ${G.gameTime}: ${moveName}(${a}) → ${ok}`);
    }

    return G; // same reference, already mutated
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  reset() {
    this.moveHistory = [];
  }

  getStats() {
    const total   = this.moveHistory.length;
    const success = this.moveHistory.filter(m => m.success).length;
    const breakdown = {};
    for (const m of this.moveHistory) {
      breakdown[m.move] = (breakdown[m.move] || 0) + 1;
    }
    return {
      totalMoves:    total,
      successfulMoves: success,
      failedMoves:   total - success,
      successRate:   total > 0 ? `${Math.round(success / total * 100)}%` : 'N/A',
      moveBreakdown: breakdown,
    };
  }
}

module.exports = { Bot };
