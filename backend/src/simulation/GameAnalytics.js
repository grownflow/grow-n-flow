// Per-game analytics collector.
// Tracks every day's water chemistry and move outcomes so SimulationRunner
// can compute playability metrics across a batch of games.

class GameAnalytics {
  constructor(gameId, strategy) {
    this.gameId   = gameId;
    this.strategy = strategy;

    this.snapshots    = []; // every-10-day summary snapshots
    this.initialState = null;
    this.finalState   = null;

    // Cumulative transaction counts (updated from G.lastAction each day)
    this.transactions = {
      fishPurchased:     0,
      plantsPurchased:   0,
      equipmentPurchased:0,
      biofiltersBought:  0,
      fishSold:          0,
      plantsSold:        0,
      totalRevenue:      0,
      totalExpenses:     0,
      billsPaid:         0,
      repairCosts:       0,
    };

    // Game-level aggregates updated each day
    this.totals = {
      fishDeaths:            0,
      plantDeaths:           0,
      eventsEncountered:     0,
      eventsRepaired:        0,
      peakAmmonia:           0,
      minDO:                 20,
      daysWithHighAmmonia:   0,   // ammonia >= 1.0
      daysWithCriticalAmmonia: 0, // ammonia >= 2.0
      firstHarvestDay:       null,
    };

    // Internal dedup tracker for events (avoid double-counting multi-day events)
    this._seenEventKeys = new Set();
  }

  // ── Called once at game start ──────────────────────────────────────────────

  recordInitialState(G) {
    this.initialState = {
      money:    G.money,
      gameTime: G.gameTime,
      fish:     (G.fish   || []).length,
      plants:   (G.plants || []).length,
    };
  }

  // ── Called after each individual bot action (pre-turn) ───────────────────
  // G.lastAction is the action that just ran; G.gameTime is the current day.
  // This must be called for every bot move because progressTurn will overwrite
  // G.lastAction before recordDay gets a chance to see it.

  trackTransaction(action, gameTime) {
    if (!action) return;
    this._processAction(action);

    // Track first revenue event
    if (!this.totals.firstHarvestDay && gameTime != null) {
      if ((action.type === 'sellFish'     && action.success) ||
          (action.type === 'sellProducts' && action.success)) {
        this.totals.firstHarvestDay = gameTime;
      }
    }

    // Repairs counted here (the bot does them before progressTurn)
    if (action.type === 'repairSystem' && action.success) {
      this.totals.eventsRepaired++;
    }
  }

  // ── Called every day after progressTurn ───────────────────────────────────
  // Captures water chemistry state, fish/plant deaths, and event detection.
  // Bill payments are also captured here since they come from progressTurn's
  // lastAction.

  recordDay(G) {
    const water   = G.aquaponicsSystem?.tank?.water || {};
    const ammonia = Number(water.ammonia        || 0);
    const do_     = Number(water.dissolvedOxygen || 8);

    // Water chemistry peaks
    if (ammonia > this.totals.peakAmmonia) this.totals.peakAmmonia = ammonia;
    if (do_     < this.totals.minDO)       this.totals.minDO       = do_;
    if (ammonia >= 1.0) this.totals.daysWithHighAmmonia++;
    if (ammonia >= 2.0) this.totals.daysWithCriticalAmmonia++;

    // Deaths come from progressTurn's lastAction
    const action = G.lastAction;
    if (action?.type === 'progressTurn') {
      this.totals.fishDeaths  += (action.fishDeaths  || []).length;
      this.totals.plantDeaths += (action.plantDeaths || []).length;
      // Bill payments
      if (action.billPayment?.paid) {
        const bill = action.billPayment.total || 0;
        this.transactions.billsPaid     += bill;
        this.transactions.totalExpenses += bill;
      }
    }

    // Count each unique event once across its full duration
    if (G.activeEvent) {
      const key = `${G.activeEvent.id}_${G.activeEvent.triggeredAt ?? G.activeEvent.detectedAt ?? G.gameTime}`;
      if (!this._seenEventKeys.has(key)) {
        this._seenEventKeys.add(key);
        this.totals.eventsEncountered++;
      }
    }
  }

  _processAction(action) {
    if (!action) return;

    switch (action.type) {
      case 'addFish':
        if (action.success) {
          this.transactions.fishPurchased += action.quantity || 0;
          this.transactions.totalExpenses += action.cost    || 0;
        }
        break;

      case 'plantSeed':
        if (action.success) {
          this.transactions.plantsPurchased += 1;
          this.transactions.totalExpenses   += action.cost || 0;
        }
        break;

      case 'plantSeedsBulk':
        if (action.success) {
          this.transactions.plantsPurchased += action.plantedCount || 0;
          this.transactions.totalExpenses   += action.totalCost   || 0;
        }
        break;

      case 'buyEquipment':
        if (action.success) {
          this.transactions.equipmentPurchased++;
          this.transactions.totalExpenses += action.cost || 0;
          if (action.equipmentType === 'biofilter') {
            this.transactions.biofiltersBought++;
          }
        }
        break;

      case 'sellFish':
        if (action.success) {
          this.transactions.fishSold    += (action.fishSold || []).length;
          this.transactions.totalRevenue += action.totalValue || 0;
        }
        break;

      case 'sellProducts':
        if (action.success) {
          this.transactions.plantsSold  += action.quantity   || 0;
          this.transactions.totalRevenue += action.totalValue || 0;
        }
        break;

      // progressTurn bill payments are handled in recordDay, not here.

      case 'repairSystem':
        if (action.success) {
          this.transactions.repairCosts  += action.cost || 0;
          this.transactions.totalExpenses += action.cost || 0;
        }
        break;
    }
  }

  // ── Every-10-day snapshot (full timeline) ─────────────────────────────────

  recordSnapshot(G, ctx) {
    const water = G.aquaponicsSystem?.tank?.water || {};
    const tank  = G.aquaponicsSystem?.tank        || {};

    this.snapshots.push({
      day:                 G.gameTime,
      money:               Number(Number(G.money || 0).toFixed(2)),
      fish:                (G.fish   || []).length,
      plants:              (G.plants || []).length,
      avgFishHealth:       this._avgFishHealth(G),
      ammonia:             Number(Number(water.ammonia         || 0).toFixed(3)),
      nitrite:             Number(Number(water.nitrite         || 0).toFixed(3)),
      nitrate:             Number(Number(water.nitrate         || 0).toFixed(1)),
      dissolvedOxygen:     Number(Number(water.dissolvedOxygen || 0).toFixed(2)),
      pH:                  Number(Number(water.pH              || 7).toFixed(2)),
      biofilterEfficiency: Number(Number(tank.biofilterEfficiency || 0.8).toFixed(3)),
      fishFood:            Number(G.fishFood || 0),
      activeEvent:         G.activeEvent ? G.activeEvent.name : null,
    });
  }

  _avgFishHealth(G) {
    const fish = G.fish || [];
    if (fish.length === 0) return 0;
    return Number(
      (fish.reduce((s, f) => s + Number(f.health || 0), 0) / fish.length).toFixed(2)
    );
  }

  // ── Called once when the game ends ────────────────────────────────────────

  recordFinalState(G, outcome, outcomeReason) {
    this.finalState = {
      money:        Number(Number(G.money || 0).toFixed(2)),
      gameTime:     G.gameTime,
      fish:         (G.fish   || []).length,
      plants:       (G.plants || []).length,
      outcome,
      outcomeReason,
    };
  }

  // ── Report ─────────────────────────────────────────────────────────────────

  getReport() {
    const moneyChange = this.finalState
      ? this.finalState.money - this.initialState.money
      : 0;
    const netProfit  = this.transactions.totalRevenue - this.transactions.totalExpenses;
    const days       = Math.max(1, this.finalState?.gameTime || 1);

    return {
      initial:        this.initialState,
      final:          this.finalState,
      moneyChange:    Number(moneyChange.toFixed(2)),
      netProfit:      Number(netProfit.toFixed(2)),
      avgDailyProfit: Number((netProfit / days).toFixed(2)),
      transactions:   this.transactions,
      totals: {
        ...this.totals,
        peakAmmonia: Number(this.totals.peakAmmonia.toFixed(3)),
        minDO:       Number(this.totals.minDO.toFixed(2)),
      },
      timeline: this.snapshots,
    };
  }

  getSummary() {
    const { timeline, ...summary } = this.getReport();
    return summary;
  }
}

module.exports = { GameAnalytics };
