const { Tank } = require('./Tank');
const { GrowBed } = require('./GrowBed');
const { Light } = require('./Light');

/*
  Initial implementation based on the Ebb and Flow Media-Based
  Flood and Drain aquaponics system. Ensure modularity for 
  future expansion. - Ravon
*/

class AquaponicsSystem {
  constructor() {
    this.id = `system_${Date.now()}`;
    this.tank = new Tank(1000);
    this.growBeds = {}; // bedId -> GrowBed
    this.light = new Light();
    this.log = [];
  }

  addGrowBed(bedId, plantType, capacity = 16) {
    const bed = new GrowBed(bedId, plantType, capacity);
    this.growBeds[bedId] = bed;
    return bed;
  }

  getGrowBed(bedId) {
    return this.growBeds[bedId] || null;
  }

  processTurn(fishEntities = [], plants = []) {

    // Calculate total nutrition usage from all grow beds
    let totalNutritionUsage = 0;
    Object.values(this.growBeds).forEach(bed => {
      totalNutritionUsage += bed.calculateNutrientDemand();
    });

    // Let Tank process with fish ammonia and plant nutrition usage
    const tankEntry = this.tank.processTurn(fishEntities, totalNutritionUsage);

    // Grow plants in all beds (pass water chemistry and light status)
    let totalPlantGrowth = 0;
    const allGrowthReports = [];
    let systemNutrientConsumption = {
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      calcium: 0,
      magnesium: 0,
      iron: 0
    };

    Object.values(this.growBeds).forEach(bed => {
      const waterChemistry = this.tank.water;
      const lightAvailable = this.light.isOn;
      
      const result = bed.growAll(waterChemistry, lightAvailable);
      totalPlantGrowth += result.totalGrowth;
      allGrowthReports.push({
        bedId: bed.id,
        ...result
      });
      
      // Accumulate nutrient consumption
      systemNutrientConsumption.nitrogen += result.totalNutrientConsumption.nitrogen;
      systemNutrientConsumption.phosphorus += result.totalNutrientConsumption.phosphorus;
      systemNutrientConsumption.potassium += result.totalNutrientConsumption.potassium;
      systemNutrientConsumption.calcium += result.totalNutrientConsumption.calcium;
      systemNutrientConsumption.magnesium += result.totalNutrientConsumption.magnesium;
      systemNutrientConsumption.iron += result.totalNutrientConsumption.iron;
    });

    // Deduct consumed nutrients from water chemistry
    this.tank.water.nitrate = Math.max(0, this.tank.water.nitrate - systemNutrientConsumption.nitrogen);
    this.tank.water.phosphorus = Math.max(0, this.tank.water.phosphorus - systemNutrientConsumption.phosphorus);
    this.tank.water.potassium = Math.max(0, this.tank.water.potassium - systemNutrientConsumption.potassium);
    this.tank.water.calcium = Math.max(0, this.tank.water.calcium - systemNutrientConsumption.calcium);
    this.tank.water.magnesium = Math.max(0, this.tank.water.magnesium - systemNutrientConsumption.magnesium);
    this.tank.water.iron = Math.max(0, this.tank.water.iron - systemNutrientConsumption.iron);

    const entry = {
      timestamp: new Date().toISOString(),
      waterStatus: this.tank.water.getStatus(),
      totalPlantGrowth: Number(totalPlantGrowth.toFixed(2)),
      totalNutritionUsage: Number(totalNutritionUsage.toFixed(3)),
      nutrientConsumption: systemNutrientConsumption,
      growBedCount: Object.keys(this.growBeds).length,
      light: this.light.getStatus(),
      growthReports: allGrowthReports
    };

    this.log.push(entry);
    return entry;
  }

  getStatus() {
    return {
      id: this.id,
      tank: this.tank.getStatus(),
      growBeds: Object.values(this.growBeds).map(bed => bed.getStatus()),
      light: this.light.getStatus()
    };
  }
}

module.exports = { AquaponicsSystem };
