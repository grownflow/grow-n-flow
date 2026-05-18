// Equipment definitions with costs and benefits
// All equipment available for purchase in the aquaponics game

const equipment = {

  
  // Fish equipment
  fishFood: { 
    cost: 20, 
    type: 'consumable', 
    description: 'High-quality fish food (10 units)',
    dailyElectricityCost: 0
  },

  // Biofilter — permanent efficiency upgrade + storable consumable for ammonia/nitrite spikes
  biofilter: {
    cost: 120,
    type: 'consumable',
    description: 'Biofilter unit. Permanently improves nitrogen cycle efficiency (+5%) and reduces ammonia/nitrite when applied.',
    dailyElectricityCost: 0,
    waterEffects: {
      ammoniaDeltaMgL: -1.5,
      nitriteDeltaMgL: -0.8
    }
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
  aerationStones: {
    cost: 25,
    type: 'consumable',
    description: 'Aeration stones (pack of 10). Each stone boosts dissolved oxygen by 2.0 mg/L.',
    dailyElectricityCost: 0,
    packQuantity: 10,
    waterEffects: {
      dissolvedOxygenDeltaMgL: 2.0
    }
  },

};

module.exports = { equipment };
