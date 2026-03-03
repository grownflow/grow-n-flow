const { WaterChemistry } = require('./WaterChemistry');

class Tank {
  constructor(volumeLiters = 1000) {
    this.id = `tank_${Date.now()}`;
    this.volumeLiters = volumeLiters;
    this.currentWaterLevel = volumeLiters; // Starts full
    this.water = new WaterChemistry();
    this.biofilterEfficiency = 0.8;
    this.log = [];
  }

  processTurn(fishEntities, plantNutritionUsage = 0) {
    // Calculate ammonia from fish waste
    const ammoniaProduced = fishEntities.reduce(
      (acc, f) => acc + (f.count * f.ammoniaProductionRate), 
      0
    );
    
    // Update water chemistry
    this.water.update(ammoniaProduced, plantNutritionUsage, this.biofilterEfficiency);
    
    const entry = {
      timestamp: new Date().toISOString(),
      waterStatus: this.water.getStatus(),
      ammoniaProduced: Number(ammoniaProduced.toFixed(3)),
      plantNutritionUsage: Number(plantNutritionUsage.toFixed(3))
    };
    
    this.log.push(entry);
    return entry;
  }

  getStatus() {
    return {
      id: this.id,
      volumeLiters: this.volumeLiters,
      currentWaterLevel: this.currentWaterLevel,
      waterLevelPercent: Number(((this.currentWaterLevel / this.volumeLiters) * 100).toFixed(1)),
      water: this.water.getStatus()
    };
  }
}

module.exports = { Tank };
