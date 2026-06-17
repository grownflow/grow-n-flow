// Headless batch simulation runner.
// Runs games without Express or boardgame.io server — state is a plain object
// mutated directly by move functions, exactly as the server does it.

const { AquaponicsGame } = require('../game/game');
const { createBot } = require('./BotStrategies');
const { GameAnalytics } = require('./GameAnalytics');
const moves = require('../game/moves');

// Suppress per-day console.log spam from moves when not in verbose mode.
function quietly(fn, verbose) {
  if (verbose) return fn();
  const noop = () => {};
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = noop;
  console.warn = noop;
  try {
    fn();
  } finally {
    console.log  = saved.log;
    console.warn = saved.warn;
  }
}

class SimulationRunner {
  constructor(config = {}) {
    this.config = {
      maxTurns:            config.maxTurns            ?? 100,
      bankruptcyThreshold: config.bankruptcyThreshold ?? -500,
      successThreshold:    config.successThreshold    ?? 5000,
      maxActionsPerDay:    config.maxActionsPerDay    ?? 15,
      batchSize:           config.batchSize           ?? 50,
      verbose:             config.verbose             ?? false,
      silent:              config.silent              ?? false, // suppress all batch progress output
      ...config,
    };
    this.results = [];
  }

  // ── Single game ────────────────────────────────────────────────────────────

  async runSingleGame(strategy = 'balanced', botConfig = {}) {
    const t0     = Date.now();
    const gameId = `sim_${t0}_${Math.random().toString(36).slice(2, 9)}`;

    // Fresh game state — plain mutable object, no server required.
    const G   = AquaponicsGame.setup();
    const ctx = { currentPlayer: '0', turn: 1, numPlayers: 1,
                  playOrder: ['0'], playOrderPos: 0 };

    const bot       = createBot(strategy, { ...botConfig, verbose: this.config.verbose });
    const analytics = new GameAnalytics(gameId, strategy);
    analytics.recordInitialState(G);

    let outcome       = 'in_progress';
    let outcomeReason = '';

    while (outcome === 'in_progress' && G.gameTime < this.config.maxTurns) {
      try {
        // Pre-turn actions: bots make decisions until they return null (= "progress day").
        // trackTransaction is called after each action because progressTurn will
        // overwrite G.lastAction before recordDay has a chance to see buy/sell actions.
        let actionsThisTurn = 0;
        while (actionsThisTurn < this.config.maxActionsPerDay) {
          const decision = await bot.makeDecision(G, ctx);
          if (!decision) break;
          await bot.executeMove(G, ctx, decision.moveName, decision.args);
          analytics.trackTransaction(G.lastAction, G.gameTime);
          actionsThisTurn++;
        }

        // Advance one game day.  All moves mutate G in place and return nothing.
        // progressTurn({ G, ctx }) is the correct boardgame.io-style call.
        quietly(() => moves.progressTurn({ G, ctx }), this.config.verbose);
        ctx.turn++;

        // Record analytics.
        analytics.recordDay(G);
        if (G.gameTime % 10 === 0) analytics.recordSnapshot(G, ctx);

        const end = this.checkEndConditions(G);
        if (end.ended) {
          outcome       = end.outcome;
          outcomeReason = end.reason;
        }

      } catch (err) {
        console.error(`[Sim] Error in ${gameId} day ${G.gameTime}:`, err.message);
        outcome       = 'error';
        outcomeReason = err.message;
        break;
      }
    }

    if (outcome === 'in_progress') {
      outcome       = 'time_limit';
      outcomeReason = `Reached day ${G.gameTime}`;
    }

    analytics.recordFinalState(G, outcome, outcomeReason);

    const result = {
      gameId,
      strategy,
      outcome,
      outcomeReason,
      gameDays:        G.gameTime,
      executionTimeMs: Date.now() - t0,
      finalState:      this.extractFinalState(G),
      analytics:       analytics.getReport(),
      botStats:        bot.getStats(),
    };

    if (this.config.verbose) {
      console.log(
        `[${gameId}] ${strategy} | ${outcome} (${outcomeReason}) | ` +
        `day ${G.gameTime} | $${Number(G.money).toFixed(2)}`
      );
    }

    return result;
  }

  // ── End conditions ─────────────────────────────────────────────────────────

  checkEndConditions(G) {
    if (G.money < this.config.bankruptcyThreshold) {
      return { ended: true, outcome: 'bankruptcy',
               reason: `Money below $${this.config.bankruptcyThreshold}` };
    }
    if (G.money >= this.config.successThreshold) {
      return { ended: true, outcome: 'success',
               reason: `Reached $${this.config.successThreshold}` };
    }
    if (G.gameTime >= this.config.maxTurns) {
      return { ended: true, outcome: 'time_limit',
               reason: `Day ${this.config.maxTurns} reached` };
    }
    return { ended: false };
  }

  // ── Final state snapshot ───────────────────────────────────────────────────

  extractFinalState(G) {
    const water = G.aquaponicsSystem?.tank?.water || {};
    const tank  = G.aquaponicsSystem?.tank  || {};
    return {
      money:               Number(Number(G.money || 0).toFixed(2)),
      gameDays:            G.gameTime,
      fishCount:           (G.fish   || []).length,
      plantCount:          (G.plants || []).length,
      biofilterEfficiency: Number(Number(tank.biofilterEfficiency || 0.8).toFixed(3)),
      ammonia:             Number(Number(water.ammonia        || 0).toFixed(3)),
      nitrate:             Number(Number(water.nitrate        || 0).toFixed(1)),
      dissolvedOxygen:     Number(Number(water.dissolvedOxygen|| 0).toFixed(2)),
      fishFood:                Number(G.fishFood || 0),
      highestMilestoneMoney:   G.highestMilestoneMoney || 0,
      stableEcosystemDays:     G.stableEcosystemDays   || 0,
      equipment:               G.equipment || {},
    };
  }

  // ── Batch runner ───────────────────────────────────────────────────────────

  async runBatch(count = 10, strategies = 'balanced') {
    const stratList = Array.isArray(strategies) ? strategies : [strategies];
    const log = (...args) => { if (!this.config.silent) console.log(...args); };
    const tick = (msg)    => { if (!this.config.silent) process.stdout.write(msg); };

    log(
      `\n🎮  ${count} games · strategies: ${stratList.join(', ')} · ` +
      `max ${this.config.maxTurns} days/game · success at $${this.config.successThreshold}\n`
    );

    this.results = [];
    let completed = 0;

    for (let i = 0; i < count; i += this.config.batchSize) {
      const chunk    = Math.min(this.config.batchSize, count - i);
      const promises = Array.from({ length: chunk }, (_, j) => {
        const strat = stratList[(i + j) % stratList.length];
        return this.runSingleGame(strat);
      });

      const chunkResults = await Promise.all(promises);
      this.results.push(...chunkResults);
      completed += chunk;
      tick(`   ${completed}/${count} (${Math.round(completed/count*100)}%)\r`);
    }

    log(`\n\n✅  Batch complete — ${this.results.length} games finished\n`);
    return this.results;
  }

  // ── Aggregate statistics ───────────────────────────────────────────────────

  getAggregateStats() {
    if (this.results.length === 0) return { error: 'No results yet' };

    const outcomes    = {};
    const byStrategy  = {};

    for (const r of this.results) {
      outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1;

      if (!byStrategy[r.strategy]) {
        byStrategy[r.strategy] = {
          count: 0, outcomes: {},
          _days: 0, _money: 0,
          _fishDeaths: 0, _plantDeaths: 0,
          _revenue: 0, _repairCosts: 0,
          _peakAmmonias: [], _firstHarvestDays: [],
          _eventsEncountered: 0, _eventsRepaired: 0,
          _biofiltersBought: 0,
          _milestones: { 0: 0, 1500: 0, 2500: 0, 5000: 0 },
        };
      }
      const s = byStrategy[r.strategy];
      s.count++;
      s.outcomes[r.outcome] = (s.outcomes[r.outcome] || 0) + 1;
      s._days         += r.gameDays;
      s._money        += r.finalState.money;
      s._fishDeaths   += r.analytics.totals.fishDeaths      || 0;
      s._plantDeaths  += r.analytics.totals.plantDeaths     || 0;
      s._revenue      += r.analytics.transactions.totalRevenue  || 0;
      s._repairCosts  += r.analytics.transactions.repairCosts   || 0;
      s._biofiltersBought += r.analytics.transactions.biofiltersBought || 0;
      s._eventsEncountered += r.analytics.totals.eventsEncountered || 0;
      s._eventsRepaired    += r.analytics.totals.eventsRepaired   || 0;
      const tier = r.finalState.highestMilestoneMoney || 0;
      const key  = [5000, 2500, 1500].find(t => tier >= t) || 0;
      s._milestones[key] = (s._milestones[key] || 0) + 1;
      if (r.analytics.totals.peakAmmonia != null) {
        s._peakAmmonias.push(r.analytics.totals.peakAmmonia);
      }
      if (r.analytics.totals.firstHarvestDay) {
        s._firstHarvestDays.push(r.analytics.totals.firstHarvestDay);
      }
    }

    // Compute per-strategy averages — all numeric fields stored as raw numbers
    // so the sensitivity script can do arithmetic on them directly.
    // The CLI printer in run-simulations.js handles formatting.
    for (const [, s] of Object.entries(byStrategy)) {
      const n = s.count;
      s.successRatePct     = Math.round((s.outcomes.success || 0) / n * 100);
      s.survivalRatePct    = Math.round((n - (s.outcomes.bankruptcy||0) - (s.outcomes.fish_death||0)) / n * 100);
      s.avgDays            = Math.round(s._days  / n * 10) / 10;
      s.avgFinalMoney      = Math.round(s._money / n * 100) / 100;
      s.avgRevenue         = Math.round(s._revenue    / n * 100) / 100;
      s.avgRepairCosts     = Math.round(s._repairCosts / n * 100) / 100;
      s.avgFishDeaths      = Math.round(s._fishDeaths  / n * 10) / 10;
      s.avgPlantDeaths     = Math.round(s._plantDeaths / n * 10) / 10;
      s.avgBiofiltersBought= Math.round(s._biofiltersBought / n * 10) / 10;
      s.avgPeakAmmonia     = s._peakAmmonias.length
        ? Math.round(s._peakAmmonias.reduce((a, b) => a + b, 0) / s._peakAmmonias.length * 1000) / 1000
        : null;
      // null = no events encountered (so "N/A" rather than 0%)
      s.eventRepairRatePct = s._eventsEncountered > 0
        ? Math.round(s._eventsRepaired / s._eventsEncountered * 100)
        : null;
      s.avgFirstHarvestDay = s._firstHarvestDays.length
        ? Math.round(s._firstHarvestDays.reduce((a, b) => a + b, 0) / s._firstHarvestDays.length * 10) / 10
        : null;
      const gamesN = s.count;
      s.milestonePct = {
        none:        Math.round((s._milestones[0]    || 0) / gamesN * 100),
        established: Math.round((s._milestones[1500] || 0) / gamesN * 100),
        profitable:  Math.round((s._milestones[2500] || 0) / gamesN * 100),
        thriving:    Math.round((s._milestones[5000] || 0) / gamesN * 100),
      };
    }

    const avgMs = this.results.reduce((s, r) => s + r.executionTimeMs, 0) / this.results.length;

    return {
      totalGames: this.results.length,
      outcomes,
      byStrategy,
      avgExecutionTimeMs: avgMs.toFixed(0),
    };
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  exportResults(filename = null) {
    const data = {
      config:         this.config,
      timestamp:      new Date().toISOString(),
      totalGames:     this.results.length,
      aggregateStats: this.getAggregateStats(),
      results:        this.results,
    };
    if (filename) {
      require('fs').writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`📁  Results saved to ${filename}`);
    }
    return data;
  }
}

module.exports = { SimulationRunner };
