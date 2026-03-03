// Game events - both technical and social
// Events can trigger during gameplay and affect the aquaponics system

const EVENT_TYPES = {
  TECHNICAL: 'technical',
  SOCIAL: 'social'
};

const EVENTS = {
  // Test event - high probability for demonstration
  testEvent: {
    id: 'testEvent',
    type: EVENT_TYPES.SOCIAL,
    name: 'Market Day Bonus',
    description: 'The farmers market is extra busy today!',
    cause: 'Local festival',
    effects: {
      message: 'Great day for sales!'
    },
    duration: 1, // just 1 day
    probability: 0.5, // 50% chance - triggers frequently for testing
    severity: 'low'
  },

  // Technical Events - affect system components
  powerOutage: {
    id: 'powerOutage',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Power Outage',
    description: 'A giant thunderstorm has knocked out power to your facility',
    cause: 'Giant thunderstorm',
    effects: {
      lightsDisabled: true
    },
    duration: 1, // days
    probability: 0.05, // 5% chance per turn
    severity: 'high'
  },

  // Social Events - affect economy/market conditions
  gasPriceSpike: {
    id: 'gasPriceSpike',
    type: EVENT_TYPES.SOCIAL,
    name: 'Gas Price Spike',
    description: 'Gas prices have skyrocketed',
    cause: 'Gas prices have skyrocketed',
    effects: {
      transportCost: 100 // +$100 cost to market
    },
    duration: 5,
    probability: 0.06,
    severity: 'medium'
  },

  // System Damage Events
  waterLeak: {
    id: 'waterLeak',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Water Leak',
    description: 'A leak has developed in your tank',
    cause: 'Wear and tear on tank seals',
    effects: {
      waterLossPerTurn: 50 // liters per day
    },
    duration: 999, // Lasts until repaired
    probability: 0.04, // 4% chance per turn
    severity: 'high',
    repairCost: 75
  },

  pumpFailure: {
    id: 'pumpFailure',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Pump Failure',
    description: 'Your water pump has stopped working',
    cause: 'Motor burnout',
    effects: {
      circulationStopped: true
    },
    duration: 999, // Lasts until repaired
    probability: 0.03, // 3% chance per turn
    severity: 'high',
    repairCost: 100
  },

  filterClog: {
    id: 'filterClog',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Filter Clog',
    description: 'Your biofilter is clogged with debris',
    cause: 'Accumulated waste',
    effects: {
      biofilterEfficiencyReduction: 0.5 // Reduces efficiency by 50%
    },
    duration: 999, // Lasts until repaired
    probability: 0.05, // 5% chance per turn
    severity: 'medium',
    repairCost: 50
  }
};

module.exports = {
  EVENTS,
  EVENT_TYPES
};
