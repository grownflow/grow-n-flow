// Game Analytics - Tracks metrics throughout game simulation
// Aim for format that allows histogram usage

class GameAnalytics {
  constructor(gameId, strategy) {
    this.gameId = gameId;
    this.strategy = strategy;
    this.snapshots = []; // State at different points in time
    this.events = [];
    this.transactions = {
      fishPurchased: 0,
      plantsPurchased: 0,
      equipmentPurchased: 0,
      fishSold: 0,
      plantsSold: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      billsPaid: 0,
      repairCosts: 0
    };
    this.initialState = null;
    this.finalState = null;
  }

  /**
   * Record initial game state
   */
  recordInitialState(G) {
    this.initialState = {
      money: G.money,
      gameTime: G.gameTime,
      fish: G.fish ? G.fish.length : 0,
      plants: G.plants ? G.plants.length : 0
    };
  }

  /**
   * Record periodic snapshot of game state
   * @param {Object} G - Game state
   * @param {Object} ctx - Game context
   */
  recordSnapshot(G, ctx) {
    // Only record snapshots periodically (every 10 days)
    if (G.gameTime % 10 !== 0) return;

    const snapshot = {
      day: G.gameTime,
      turn: ctx.turn,
      money: Number(G.money.toFixed(2)),
      fish: G.fish ? G.fish.length : 0,
      plants: G.plants ? G.plants.length : 0,
      fishHealth: this.calculateAverageFishHealth(G),
      equipment: G.equipment ? Object.keys(G.equipment).length : 0,
      tankWaterLevel: G.aquaponicsSystem?.tank?.currentWaterLevel || 0,
      hasActiveEvent: !!G.activeEvent
    };

    this.snapshots.push(snapshot);

    // Track transactions from lastAction
    if (G.lastAction) {
      this.processLastAction(G.lastAction);
    }

    // Track events
    if (G.activeEvent && !this.events.find(e => e.triggeredAt === G.activeEvent.triggeredAt)) {
      this.events.push({
        day: G.gameTime,
        event: G.activeEvent.name,
        severity: G.activeEvent.severity,
        repairCost: G.activeEvent.repairCost || 0
      });
    }
  }

  /**
   * Process lastAction to track transactions
   */
  processLastAction(action) {
    switch (action.type) {
      case 'buyFish':
        if (action.success) {
          this.transactions.fishPurchased += action.count || 0;
          this.transactions.totalExpenses += action.cost || 0;
        }
        break;

      case 'buyPlantSeeds':
        if (action.success) {
          this.transactions.plantsPurchased += action.count || 0;
          this.transactions.totalExpenses += action.cost || 0;
        }
        break;

      case 'buyEquipment':
        if (action.success) {
          this.transactions.equipmentPurchased++;
          this.transactions.totalExpenses += action.cost || 0;
        }
        break;

      case 'sellFish':
        if (action.success) {
          this.transactions.fishSold += action.fishSold ? action.fishSold.length : 0;
          this.transactions.totalRevenue += action.totalValue || 0;
        }
        break;

      case 'sellPlants':
        if (action.success) {
          this.transactions.plantsSold += action.plantsSold ? action.plantsSold.length : 0;
          this.transactions.totalRevenue += action.totalValue || 0;
        }
        break;

      case 'progressTurn':
        if (action.billPayment && action.billPayment.paid) {
          this.transactions.billsPaid += action.billPayment.total || 0;
          this.transactions.totalExpenses += action.billPayment.total || 0;
        }
        break;

      case 'repairSystem':
        if (action.success) {
          this.transactions.repairCosts += action.cost || 0;
          this.transactions.totalExpenses += action.cost || 0;
        }
        break;
    }
  }

  /**
   * Calculate average fish health
   */
  calculateAverageFishHealth(G) {
    if (!G.fish || G.fish.length === 0) return 0;
    const totalHealth = G.fish.reduce((sum, fish) => sum + (fish.health || 0), 0);
    return Number((totalHealth / G.fish.length).toFixed(2));
  }

  /**
   * Record final game state and outcome
   */
  recordFinalState(G, outcome, outcomeReason) {
    this.finalState = {
      money: Number(G.money.toFixed(2)),
      gameTime: G.gameTime,
      fish: G.fish ? G.fish.length : 0,
      plants: G.plants ? G.plants.length : 0,
      outcome,
      outcomeReason
    };
  }

  /**
   * Generate analytics report
   */
  getReport() {
    const moneyChange = this.finalState 
      ? this.finalState.money - this.initialState.money 
      : 0;

    const netProfit = this.transactions.totalRevenue - this.transactions.totalExpenses;
    const avgDailyProfit = this.finalState 
      ? netProfit / Math.max(1, this.finalState.gameTime)
      : 0;

    return {
      initial: this.initialState,
      final: this.finalState,
      moneyChange: Number(moneyChange.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      avgDailyProfit: Number(avgDailyProfit.toFixed(2)),
      transactions: this.transactions,
      events: this.events,
      snapshotCount: this.snapshots.length,
      timeline: this.snapshots // Full timeline for detailed analysis
    };
  }

  /**
   * Get summary statistics (lightweight version without timeline)
   */
  getSummary() {
    const report = this.getReport();
    // Exclude timeline for summary
    const { timeline, ...summary } = report;
    return summary;
  }
}

module.exports = { GameAnalytics };
