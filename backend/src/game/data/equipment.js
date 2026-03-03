// Equipment definitions with costs and benefits
// All equipment available for purchase in the aquaponics game

const equipment = {
  // Water quality equipment
  phMeter: { 
    cost: 50, 
    type: 'monitoring', 
    description: 'pH monitoring device',
    dailyElectricityCost: 0.5
  },
  thermometer: { 
    cost: 30, 
    type: 'monitoring', 
    description: 'Water temperature sensor',
    dailyElectricityCost: 0.3
  },
  oxygenMeter: { 
    cost: 80, 
    type: 'monitoring', 
    description: 'Dissolved oxygen sensor',
    dailyElectricityCost: 0.5
  },
  
  // Water treatment equipment
  waterPump: { 
    cost: 120, 
    type: 'system', 
    description: 'Improves water circulation',
    dailyElectricityCost: 3.0
  },
  airPump: { 
    cost: 60, 
    type: 'system', 
    description: 'Increases oxygen levels',
    dailyElectricityCost: 2.0
  },
  biofilter: { 
    cost: 200, 
    type: 'system', 
    description: 'Improves nitrogen cycle efficiency',
    dailyElectricityCost: 1.0
  },
  
  // Growing equipment
  growLight: { 
    cost: 100, 
    type: 'growing', 
    description: 'LED grow light for plants',
    dailyElectricityCost: 10.0
  },
  growBed: { 
    cost: 80, 
    type: 'growing', 
    description: 'Additional growing space',
    dailyElectricityCost: 0
  },
  
  // Fish equipment
  fishFood: { 
    cost: 20, 
    type: 'consumable', 
    description: 'High-quality fish food (10 units)',
    dailyElectricityCost: 0
  },
  fishTank: { 
    cost: 150, 
    type: 'system', 
    description: 'Additional fish tank capacity',
    dailyElectricityCost: 0
  }
};

module.exports = { equipment };
