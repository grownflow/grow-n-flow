// Base Bot class for automated game playing
// Bots analyze game state and make decisions based on strategy

const moves = require('../game/moves');

class Bot {
  constructor(strategy = 'balanced', config = {}) {
    this.strategy = strategy;
    this.config = {
      riskTolerance: config.riskTolerance || 0.5, // 0 = conservative, 1 = aggressive
      minMoneyBuffer: config.minMoneyBuffer || 100, // Reserve money for emergencies
      verbose: config.verbose || false,
      ...config
    };
    this.moveHistory = [];
  }

  /**
   * Main decision-making method
   * Analyzes game state and returns next move to make
   * @param {Object} G - Current game state
   * @param {Object} ctx - Game context
   * @returns {Object} { moveName, args } or null if should skip turn
   */
  async makeDecision(G, ctx) {
    // Check for critical issues first
    const criticalMove = this.handleCriticalIssues(G, ctx);
    if (criticalMove) return criticalMove;

    // Check for harvest opportunities
    const harvestMove = this.checkHarvests(G, ctx);
    if (harvestMove) return harvestMove;

    // Check for purchase opportunities
    const purchaseMove = this.checkPurchases(G, ctx);
    if (purchaseMove) return purchaseMove;

    // Check if we should feed fish
    const feedMove = this.checkFeeding(G, ctx);
    if (feedMove) return feedMove;

    // Default: progress turn
    return { moveName: 'progressTurn', args: [] };
  }

  /**
   * Handle critical issues like leaks, bankruptcy risk
   */
  handleCriticalIssues(G, ctx) {
    // Repair system damage if critical
    if (G.activeEvent && G.activeEvent.repairCost) {
      const canAfford = G.money >= G.activeEvent.repairCost;
      const isCritical = G.activeEvent.severity === 'high';
      
      if (canAfford && isCritical) {
        return { moveName: 'repairSystem', args: [] };
      }
    }

    return null;
  }

  /**
   * Check if anything is ready to harvest
   */
  checkHarvests(G, ctx) {
    // Check fish
    if (G.fish && G.fish.length > 0) {
      const harvestableFish = G.fish.filter(f => f.isHarvestable && f.isHarvestable());
      if (harvestableFish.length > 0) {
        return { moveName: 'sellFish', args: [] }; // Sell all harvestable
      }
    }

    // Check plants
    if (G.plants && G.plants.length > 0) {
      const harvestablePlants = G.plants.filter(p => p.canHarvest && p.canHarvest());
      if (harvestablePlants.length > 0) {
        return { moveName: 'sellPlants', args: [] }; // Sell all harvestable
      }
    }

    return null;
  }

  /**
   * Check if we should buy fish, plants, or equipment
   * Strategy-specific implementation in subclasses
   */
  checkPurchases(G, ctx) {
    // Override in strategy subclasses
    return null;
  }

  /**
   * Check if fish need feeding
   */
  checkFeeding(G, ctx) {
    if (!G.fish || G.fish.length === 0) return null;

    // Check if we have fish food available
    const foodAvailable = G.fishFood || 0;
    if (foodAvailable < 5) {
      // Try to buy fish food if we can afford it
      const foodCost = 20; // Cost of 10 units
      if (G.money >= foodCost + this.config.minMoneyBuffer) {
        return { moveName: 'buyFishFood', args: [1] };
      }
      return null;
    }

    // Feed first fish if we have food
    const fishIndex = 0;
    const foodAmount = Math.min(10, foodAvailable);
    return { moveName: 'feedFish', args: [fishIndex, foodAmount] };
  }

  /**
   * Execute a move and track it
   */
  async executeMove(G, ctx, moveName, args) {
    const move = moves[moveName];
    if (!move) {
      throw new Error(`Move ${moveName} not found`);
    }

    const newG = move(G, ctx, ...args);
    
    this.moveHistory.push({
      turn: ctx.turn,
      day: G.gameTime,
      move: moveName,
      args: args,
      success: !newG.error,
      error: newG.error
    });

    if (this.config.verbose) {
      console.log(`[Bot] Day ${G.gameTime}: ${moveName}(${args.join(', ')})`);
      if (newG.error) console.log(`  Error: ${newG.error}`);
    }

    return newG;
  }

  /**
   * Reset bot state for new game
   */
  reset() {
    this.moveHistory = [];
  }

  /**
   * Get statistics about bot performance
   */
  getStats() {
    return {
      totalMoves: this.moveHistory.length,
      successfulMoves: this.moveHistory.filter(m => m.success).length,
      failedMoves: this.moveHistory.filter(m => !m.success).length,
      moveBreakdown: this.getMoveBreakdown()
    };
  }

  getMoveBreakdown() {
    const breakdown = {};
    this.moveHistory.forEach(m => {
      breakdown[m.move] = (breakdown[m.move] || 0) + 1;
    });
    return breakdown;
  }
}

module.exports = { Bot };
