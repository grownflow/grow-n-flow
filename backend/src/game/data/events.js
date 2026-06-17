// Game events - both technical and social
// Events can trigger during gameplay and affect the aquaponics system

const EVENT_TYPES = {
  TECHNICAL: 'technical',
  SOCIAL: 'social'
};

const EVENTS = {
  // Social event - harmless money bonus, no effect on fish or plants
  testEvent: {
    id: 'testEvent',
    type: EVENT_TYPES.SOCIAL,
    name: 'Market Day Bonus',
    description: 'The farmers market is extra busy today! You receive a cash bonus.',
    cause: 'Local festival',
    effects: {
      moneyBonus: 50
    },
    duration: 1,
    probability: 0.02,
    severity: 'low'
  },

  // Technical Events - reflect aquaponics failure modes and key parameters
  // Probabilities are tuned so average players face ~2-3 events per 30-day cycle.
  ammoniaSpike: {
    id: 'ammoniaSpike',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Sudden Ammonia Spike',
    description: 'Ammonia has spiked in the tank, likely from overfeeding or a fish die-off.',
    cause: 'Overfeeding, uneaten feed, or dead fish',
    effects: {
      ammoniaIncrease: 1.5,   // reduced from 2.5 — survivable with one water change
      nitriteIncrease: 0.3,
      dissolvedOxygenDecrease: 0.5
    },
    duration: 1,
    probability: 0.04,        // reduced from 0.06
    severity: 'high',
    requiresFish: true
  },

  nitriteSpike: {
    id: 'nitriteSpike',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Nitrite Rise',
    description: 'Nitrite levels are rising, likely because the biofilter is stressed or disturbed.',
    cause: 'Disturbed biofilter or heavy waste load',
    effects: {
      nitriteIncrease: 0.8,   // reduced from 1.2
      dissolvedOxygenDecrease: 0.3
    },
    duration: 1,
    probability: 0.03,        // reduced from 0.05
    severity: 'high',
    requiresFish: true
  },

  lowDissolvedOxygen: {
    id: 'lowDissolvedOxygen',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Low Dissolved Oxygen',
    description: 'Dissolved oxygen has dropped below safe levels due to overcrowding or solids buildup.',
    cause: 'Poor aeration, solids buildup, or overcrowding',
    effects: {
      dissolvedOxygenDecrease: 1.5, // reduced from 2.5 — add aeration stones to fix
      circulationEfficiencyReduction: 0.2
    },
    duration: 1,
    probability: 0.03,        // reduced from 0.05
    severity: 'high'
  },

  fishDiseaseOutbreak: {
    id: 'fishDiseaseOutbreak',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Fish Disease Outbreak',
    description: 'A disease outbreak is stressing your fish and producing additional waste.',
    cause: 'Poor water quality or pathogen introduction',
    effects: {
      ammoniaIncrease: 1.0,
      nitriteIncrease: 0.5,
      dissolvedOxygenDecrease: 0.5,
      fishHealthReduction: 1.5,    // reduced from 2.5
      // Each day of the event, only ~20% of fish are individually affected.
      fishHealthReductionFraction: 0.20
    },
    duration: 2,
    probability: 0.015,       // reduced from 0.02
    severity: 'high',
    requiresFish: true
  },

  plantDiseaseOutbreak: {
    id: 'plantDiseaseOutbreak',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Plant Disease Outbreak',
    description: 'A disease outbreak is impacting your plants and reducing nutrient availability.',
    cause: 'Pathogens or nutrient imbalance',
    effects: {
      nitrateDecrease: 2.0,
      ironDecrease: 0.5,
      plantHealthReduction: 1.2,   // reduced from 2.0
      // ~20% of plants affected per day; over 3 days weaker ones decline.
      plantHealthReductionFraction: 0.20
    },
    duration: 3,
    probability: 0.015,       // reduced from 0.02
    severity: 'medium',
    requiresPlants: true
  },

  pHCrash: {
    id: 'pHCrash',
    type: EVENT_TYPES.TECHNICAL,
    name: 'pH Drop',
    description: 'The pH is drifting downward as nitrification consumes alkalinity.',
    cause: 'Natural nitrification and low carbonate hardness',
    effects: {
      pHDecrease: 0.2
    },
    duration: 2,
    probability: 0.025,       // reduced from 0.04
    severity: 'medium'
  },

  // System Damage Events
  waterLeak: {
    id: 'waterLeak',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Water Leak',
    description: 'A leak has developed in your tank.',
    cause: 'Wear and tear on tank seals',
    effects: {
      waterLossPerTurn: 50
    },
    duration: 999,
    probability: 0.020,       // reduced from 0.025 — ~every 50 days is still challenging
    severity: 'high',
    repairCost: 75,
    quickRepairCost: 37       // stops the leak but does not refill the tank
  },

  pumpFailure: {
    id: 'pumpFailure',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Pump Failure',
    description: 'Your water pump has stopped working.',
    cause: 'Motor burnout',
    effects: {
      circulationStopped: true
    },
    duration: 999,
    probability: 0.015,       // reduced from 0.020 — dominant sensitivity driver, now ~every 67 days
    severity: 'high',
    repairCost: 100,
    quickRepairCost: 50       // restores circulation to 70%; full repair restores to 100%
  },

  filterClog: {
    id: 'filterClog',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Filter Clog',
    description: 'Your biofilter is clogged with debris and cannot process waste efficiently.',
    cause: 'Accumulated solids and uneaten food',
    effects: {
      biofilterEfficiencyReduction: 0.5
    },
    duration: 999,
    probability: 0.020,       // reduced from 0.030 — was the second-biggest difficulty driver
    severity: 'medium',
    repairCost: 50,
    quickRepairCost: 25,      // restores biofilter to 70% of pre-clog value; full repair restores 100%
    requiresFish: true
  }
};

module.exports = {
  EVENTS,
  EVENT_TYPES
};
