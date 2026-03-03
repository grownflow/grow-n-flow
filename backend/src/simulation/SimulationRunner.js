// Simulation Runner
// Runs batches of games with AI bots and collects results

const { AquaponicsGame } = require('../game/game');
const { createBot } = require('./BotStrategies');
const { GameAnalytics } = require('./GameAnalytics');

class SimulationRunner {
  constructor(config = {}) {
    this.config = {
      maxTurns: config.maxTurns || 365, // Default: 1 year
      bankruptcyThreshold: config.bankruptcyThreshold || -500,
      successThreshold: config.successThreshold || 10000,
      saveToDb: config.saveToDb || false,
      verbose: config.verbose || false,
      batchSize: config.batchSize || 100, // Process N games at a time
      ...config
    };
    this.results = [];
  }

  /**
   * Run a single game simulation
   * @param {string} strategy - Bot strategy name
   * @param {Object} botConfig - Bot configuration
   * @returns {Object} Game results
   */
  async runSingleGame(strategy = 'balanced', botConfig = {}) {
    const startTime = Date.now();
    const gameId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize game
    let G = AquaponicsGame.setup();
    let ctx = {
      currentPlayer: '0',
      turn: 1,
      numPlayers: 1,
      playOrder: ['0'],
      playOrderPos: 0
    };

    // Create bot
    const bot = createBot(strategy, { ...botConfig, verbose: this.config.verbose });
    
    // Analytics collector
    const analytics = new GameAnalytics(gameId, strategy);
    analytics.recordInitialState(G);

    let outcome = 'in_progress';
    let outcomeReason = '';
    
    // Game loop - one iteration per day
    while (outcome === 'in_progress' && G.gameTime < this.config.maxTurns) {
      try {
        // Bot can make multiple decisions per day
        const maxActionsPerDay = 10; // Prevent infinite loops
        let actionsThisTurn = 0;
        
        while (actionsThisTurn < maxActionsPerDay) {
          const decision = await bot.makeDecision(G, ctx);
          
          // If bot wants to progress turn, break out of action loop
          if (!decision || decision.moveName === 'progressTurn') {
            break;
          }
          
          // Execute bot's move
          G = await bot.executeMove(G, ctx, decision.moveName, decision.args);
          actionsThisTurn++;
        }
        
        // Always progress turn at end of day
        const moves = require('../game/moves');
        G = moves.progressTurn(G, ctx);
        ctx.turn++;

        // Record analytics snapshot every 10 days
        if (G.gameTime % 10 === 0) {
          analytics.recordSnapshot(G, ctx);
        }

        // Check end conditions
        const endCheck = this.checkEndConditions(G, ctx);
        if (endCheck.ended) {
          outcome = endCheck.outcome;
          outcomeReason = endCheck.reason;
          break;
        }

      } catch (error) {
        console.error(`[SimulationRunner] Error in game ${gameId}:`, error.message);
        outcome = 'error';
        outcomeReason = error.message;
        break;
      }
    }

    // If we hit turn limit without other outcome
    if (outcome === 'in_progress') {
      outcome = 'time_limit';
      outcomeReason = `Reached day limit (${G.gameTime} days)`;
    }

    // Finalize results
    const duration = Date.now() - startTime;
    analytics.recordFinalState(G, outcome, outcomeReason);
    
    const result = {
      gameId,
      strategy,
      outcome,
      outcomeReason,
      duration: G.gameTime, // Game days
      turns: ctx.turn,
      executionTimeMs: duration,
      finalState: this.extractFinalState(G),
      analytics: analytics.getReport(),
      botStats: bot.getStats()
    };

    if (this.config.verbose) {
      console.log(`\n[Game ${gameId}] Complete:`);
      console.log(`  Strategy: ${strategy}`);
      console.log(`  Outcome: ${outcome} (${outcomeReason})`);
      console.log(`  Duration: ${G.gameTime} days, ${ctx.turn} turns`);
      console.log(`  Final Money: $${G.money.toFixed(2)}`);
    }

    return result;
  }

  /**
   * Check if game should end
   */
  checkEndConditions(G, ctx) {
    // Bankruptcy
    if (G.money < this.config.bankruptcyThreshold) {
      return { 
        ended: true, 
        outcome: 'bankruptcy', 
        reason: `Money fell below $${this.config.bankruptcyThreshold}` 
      };
    }

    // Success
    if (G.money >= this.config.successThreshold) {
      return { 
        ended: true, 
        outcome: 'success', 
        reason: `Reached $${this.config.successThreshold}` 
      };
    }

    // All fish died
    if (G.fish && G.fish.length > 0) {
      const allDead = G.fish.every(f => f.health <= 0);
      if (allDead) {
        return { 
          ended: true, 
          outcome: 'fish_death', 
          reason: 'All fish died' 
        };
      }
    }

    // Time limit (days, not turns)
    if (G.gameTime >= this.config.maxTurns) {
      return { 
        ended: true, 
        outcome: 'time_limit', 
        reason: `Reached ${this.config.maxTurns} days` 
      };
    }

    return { ended: false };
  }

  /**
   * Extract final state metrics
   */
  extractFinalState(G) {
    return {
      money: Number(G.money.toFixed(2)),
      gameTime: G.gameTime,
      fishCount: G.fish ? G.fish.length : 0,
      plantCount: G.plants ? G.plants.length : 0,
      equipment: G.equipment || {},
      billsAccrued: G.billsAccrued || { electricity: 0, water: 0 },
      activeEvent: G.activeEvent ? G.activeEvent.name : null,
      tankWaterLevel: G.aquaponicsSystem?.tank?.currentWaterLevel || 0
    };
  }

  /**
   * Run multiple games in batch
   * @param {number} count - Number of games to run
   * @param {string|Array} strategies - Strategy name(s)
   * @returns {Array} Results from all games
   */
  async runBatch(count = 10, strategies = 'balanced') {
    console.log(`\n🎮 Starting batch simulation: ${count} games`);
    console.log(`   Strategies: ${Array.isArray(strategies) ? strategies.join(', ') : strategies}`);
    console.log(`   Max turns per game: ${this.config.maxTurns} days\n`);

    const strategyList = Array.isArray(strategies) ? strategies : [strategies];
    this.results = [];

    const batchSize = this.config.batchSize;
    let completed = 0;

    // Process in batches for memory management
    for (let i = 0; i < count; i += batchSize) {
      const batchCount = Math.min(batchSize, count - i);
      const batchPromises = [];

      for (let j = 0; j < batchCount; j++) {
        const strategy = strategyList[(i + j) % strategyList.length];
        batchPromises.push(this.runSingleGame(strategy));
      }

      // Run batch in parallel
      const batchResults = await Promise.all(batchPromises);
      this.results.push(...batchResults);
      
      completed += batchCount;
      console.log(`   Progress: ${completed}/${count} games completed (${(completed/count*100).toFixed(1)}%)`);
    }

    console.log(`\n✅ Batch complete! ${this.results.length} games finished\n`);
    return this.results;
  }

  /**
   * Get aggregated statistics from all results
   */
  getAggregateStats() {
    if (this.results.length === 0) {
      return { error: 'No results available' };
    }

    const byStrategy = {};
    const outcomes = {};

    this.results.forEach(result => {
      // By strategy
      if (!byStrategy[result.strategy]) {
        byStrategy[result.strategy] = {
          count: 0,
          outcomes: {},
          totalDays: 0,
          totalMoney: 0,
          avgDays: 0,
          avgMoney: 0
        };
      }
      const stratStats = byStrategy[result.strategy];
      stratStats.count++;
      stratStats.outcomes[result.outcome] = (stratStats.outcomes[result.outcome] || 0) + 1;
      stratStats.totalDays += result.duration;
      stratStats.totalMoney += result.finalState.money;

      // Overall outcomes
      outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;
    });

    // Calculate averages
    Object.keys(byStrategy).forEach(strategy => {
      const stats = byStrategy[strategy];
      stats.avgDays = (stats.totalDays / stats.count).toFixed(1);
      stats.avgMoney = (stats.totalMoney / stats.count).toFixed(2);
    });

    return {
      totalGames: this.results.length,
      outcomes,
      byStrategy,
      avgExecutionTimeMs: (this.results.reduce((sum, r) => sum + r.executionTimeMs, 0) / this.results.length).toFixed(0)
    };
  }

  /**
   * Export results to JSON
   */
  exportResults(filename = null) {
    const data = {
      config: this.config,
      timestamp: new Date().toISOString(),
      totalGames: this.results.length,
      aggregateStats: this.getAggregateStats(),
      results: this.results
    };

    if (filename) {
      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`📁 Results exported to ${filename}`);
    }

    return data;
  }
}

module.exports = { SimulationRunner };
