// Equipment definitions with costs and benefits
// All equipment available for purchase in the aquaponics game

const equipment = {
  // Core system upgrades
  biofilter: {
    cost: 120,
    type: 'equipment',
    description: 'Biofilter media upgrade. Improves conversion of ammonia and nitrite.',
    dailyElectricityCost: 0
  },
  waterPump: {
    cost: 90,
    type: 'equipment',
    description: 'Water pump. Improves circulation and biofilter performance.',
    dailyElectricityCost: 6
  },
  airPump: {
    cost: 75,
    type: 'equipment',
    description: 'Air pump / aerator. Increases dissolved oxygen.',
    dailyElectricityCost: 4
  },
  growLight: {
    cost: 60,
    type: 'equipment',
    description: 'Grow light. Improves plant growth.',
    dailyElectricityCost: 5
  },

  // Fish equipment
  fishFood: { 
    cost: 20, 
    type: 'consumable', 
    description: 'High-quality fish food (10 units)',
    dailyElectricityCost: 0
  },

  // Water treatment consumables (instant-use supplements)
  bufferingSolutionCalciumCarbonate: {
    cost: 15,
    type: 'consumable',
    description: 'Buffering solution (calcium carbonate). Raises pH and calcium.',
    dailyElectricityCost: 0,
    waterEffects: {
      pHDelta: 0.2,
      calciumDeltaMgL: 20
    }
  },
  bufferingSolutionPotassiumCarbonate: {
    cost: 15,
    type: 'consumable',
    description: 'Buffering solution (potassium carbonate). Raises pH and potassium.',
    dailyElectricityCost: 0,
    waterEffects: {
      pHDelta: 0.2,
      potassiumDeltaMgL: 20
    }
  },
  chelatedIronDTPA11: {
    cost: 12,
    type: 'consumable',
    description: 'Chelated Iron (DTPA 11%). Raises dissolved iron for plant uptake.',
    dailyElectricityCost: 0,
    waterEffects: {
      ironDeltaMgL: 1.0
    }
  },

};

module.exports = { equipment };
