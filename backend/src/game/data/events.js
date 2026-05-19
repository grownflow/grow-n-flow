// Game events - both technical and social
// Events can trigger during gameplay and affect the aquaponics system

const EVENT_TYPES = {
  TECHNICAL: 'technical',
  SOCIAL: 'social'
};

const EVENTS = {
  // Technical Events - affect system components
  powerOutage: {
    id: 'powerOutage',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Power Outage',
    description: 'A giant thunderstorm has knocked out power to your facility',
    cause: 'Giant thunderstorm',
    effects: {
      lightsDisabled: true,
      // If aeration/circulation are impacted, oxygen can drift down.
      waterChemistryDeltaPerTurn: {
        dissolvedOxygen: -0.6
      }
    },
    duration: 1, // days
    probability: 0.05, // 5% chance per turn
    severity: 'high',
    cooldownDays: 10,
    preconditions: {
      minDay: 2,
      minFishCount: 1
    },
    correctiveActions: [
      { action: 'buyEquipment', equipmentType: 'airPump', note: 'Raise dissolved oxygen' },
      { action: 'feedFish', note: 'Reduce feeding if oxygen is low' }
    ]
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
    repairCost: 75,
    cooldownDays: 30,
    preconditions: {
      minDay: 3,
      // Don't trigger a leak if the tank is already basically empty.
      minWaterLevelFraction: 0.25
    },
    correctiveActions: [
      { action: 'repairSystem', note: 'Stop the leak and refill to full as part of repair' },
      { action: 'waterChange', fraction: 0.25, note: 'If chemistry is off while refilling' }
    ]
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
    repairCost: 100,
    cooldownDays: 20,
    preconditions: {
      minDay: 3,
      // Only makes sense if the player has circulation equipment.
      requiresEquipment: { waterPump: 1 }
    },
    correctiveActions: [
      { action: 'repairSystem', note: 'Restore circulation so biofilter can convert ammonia/nitrite' },
      { action: 'buyEquipment', equipmentType: 'biofilter', note: 'Improve conversion rate after repair' }
    ]
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
    repairCost: 50,
    cooldownDays: 15,
    preconditions: {
      minDay: 5,
      minSediment: 5
    },
    correctiveActions: [
      { action: 'repairSystem', note: 'Restore biofilter efficiency' },
      { action: 'waterChange', fraction: 0.25, note: 'Dilute ammonia/nitrite while biofilter is impaired' }
    ]
  },

  // Waste buildup: chemistry drifts until the player takes corrective action.
  wasteBuildup: {
    id: 'wasteBuildup',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Waste Buildup',
    description: 'Organic waste is building up and stressing your system',
    cause: 'Overfeeding / insufficient removal of solids',
    effects: {
      waterChemistryDeltaPerTurn: {
        ammonia: 0.25,
        dissolvedOxygen: -0.25
      }
    },
    duration: 4,
    probability: 0.06,
    severity: 'medium',
    cooldownDays: 12,
    preconditions: {
      minDay: 4,
      minFishCount: 1,
      minSediment: 10
    },
    correctiveActions: [
      { action: 'waterChange', fraction: 0.25, note: 'Immediate dilution' },
      { action: 'removeFish', note: 'Reduce stocking if chronic' },
      { action: 'feedFish', note: 'Reduce feed to prevent more waste' }
    ]
  },

  lowOxygenCrisis: {
    id: 'lowOxygenCrisis',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Low Oxygen Crisis',
    description: 'Fish are gasping at the surface as oxygen drops dangerously low',
    cause: 'High biomass + respiration + insufficient aeration',
    effects: {
      waterChemistryDeltaPerTurn: {
        dissolvedOxygen: -0.8
      }
    },
    duration: 2,
    probability: 0.08,
    severity: 'high',
    cooldownDays: 8,
    preconditions: {
      minDay: 3,
      minFishCount: 1,
      maxWater: { dissolvedOxygen: 4.5 }
    },
    correctiveActions: [
      { action: 'buyEquipment', equipmentType: 'airPump', note: 'Increase dissolved oxygen' },
      { action: 'waterChange', fraction: 0.25, note: 'Restore water quality quickly' },
      { action: 'removeFish', note: 'Reduce oxygen demand if persistent' }
    ]
  },

  ammoniaSpike: {
    id: 'ammoniaSpike',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Ammonia Spike',
    description: 'A sudden ammonia spike is stressing your fish',
    cause: 'Overfeeding / biofilter disruption',
    effects: {
      waterChemistryDeltaPerTurn: {
        ammonia: 0.4,
        pH: -0.05
      }
    },
    duration: 3,
    probability: 0.07,
    severity: 'high',
    cooldownDays: 10,
    preconditions: {
      minDay: 4,
      minFishCount: 1,
      minWater: { ammonia: 0.7 }
    },
    correctiveActions: [
      { action: 'waterChange', fraction: 0.25, note: 'Dilute ammonia immediately' },
      { action: 'buyEquipment', equipmentType: 'biofilter', note: 'Improve conversion capacity' },
      { action: 'repairSystem', note: 'If circulation/filter issues are active, fix them' }
    ]
  },

  pHCrash: {
    id: 'pHCrash',
    type: EVENT_TYPES.TECHNICAL,
    name: 'pH Crash',
    description: 'Your system loses buffering and pH drops rapidly',
    cause: 'Nitrification consumes alkalinity over time',
    effects: {
      waterChemistryDeltaPerTurn: {
        pH: -0.18
      }
    },
    duration: 3,
    probability: 0.06,
    severity: 'medium',
    cooldownDays: 14,
    preconditions: {
      minDay: 8,
      minFishCount: 1,
      maxWater: { pH: 6.6 }
    },
    correctiveActions: [
      { action: 'buyEquipment', equipmentType: 'bufferingSolutionCalciumCarbonate', note: 'Raise pH and calcium' },
      { action: 'buyEquipment', equipmentType: 'bufferingSolutionPotassiumCarbonate', note: 'Raise pH and potassium' },
      { action: 'waterChange', fraction: 0.25, note: 'Stabilize chemistry' }
    ]
  },

  heatWave: {
    id: 'heatWave',
    type: EVENT_TYPES.TECHNICAL,
    name: 'Heat Wave',
    description: 'Ambient heat warms the tank and reduces oxygen solubility',
    cause: 'Extreme weather',
    effects: {
      waterChemistryDeltaPerTurn: {
        temperature: 1.2,
        dissolvedOxygen: -0.4
      }
    },
    duration: 3,
    probability: 0.04,
    severity: 'medium',
    cooldownDays: 20,
    preconditions: {
      minDay: 5,
      minFishCount: 1
    },
    correctiveActions: [
      { action: 'buyEquipment', equipmentType: 'airPump', note: 'Offset DO loss during heat' },
      { action: 'waterChange', fraction: 0.25, note: 'Temperature/quality stabilization' }
    ]
  }
};

module.exports = {
  EVENTS,
  EVENT_TYPES
};
