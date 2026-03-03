class GrowBed {
  constructor(id, plantType, capacity = 16) {
    this.id = id;
    this.plantType = plantType;
    this.capacity = capacity; // max plants in this bed
    this.plants = {}; // plantId -> Plant instance
    this.nutrientDemand = 0;
  }

  addPlant(plant) {
    if (Object.keys(this.plants).length >= this.capacity) {
      return { success: false, reason: 'Grow bed at capacity' };
    }
    
    this.plants[plant.id] = plant;
    return { success: true };
  }

  removePlant(plantId) {
    delete this.plants[plantId];
  }

  calculateNutrientDemand() {
    this.nutrientDemand = Object.values(this.plants).length * 0.05;
    return this.nutrientDemand;
  }

  growAll(waterChemistry, lightAvailable = true) {
    let totalGrowth = 0;
    const growthReports = [];
    let totalNutrientConsumption = {
      nitrogen: 0,
      phosphorus: 0,
      potassium: 0,
      calcium: 0,
      magnesium: 0,
      iron: 0
    };

    Object.values(this.plants).forEach(plant => {
      const report = plant.grow(waterChemistry, lightAvailable);
      growthReports.push({
        plantId: plant.id,
        ...report
      });
      
      if (report.success) {
        totalGrowth += report.growthRate;
        
        // Calculate nutrient consumption based on growth rate
        // Each plant consumes nutrients proportional to its growth
        const consumptionRate = report.growthRate * 0.1; // 10% of growth rate per week
        totalNutrientConsumption.nitrogen += plant.species.nutrientRequirements.nitrogen * consumptionRate;
        totalNutrientConsumption.phosphorus += plant.species.nutrientRequirements.phosphorus * consumptionRate;
        totalNutrientConsumption.potassium += plant.species.nutrientRequirements.potassium * consumptionRate;
        totalNutrientConsumption.calcium += plant.species.nutrientRequirements.calcium * consumptionRate;
        totalNutrientConsumption.magnesium += plant.species.nutrientRequirements.magnesium * consumptionRate;
        totalNutrientConsumption.iron += plant.species.nutrientRequirements.iron * consumptionRate;
      }
    });

    return {
      totalGrowth: Number(totalGrowth.toFixed(2)),
      totalNutrientConsumption,
      growthReports,
      plantCount: Object.keys(this.plants).length
    };
  }

  getStatus() {
    return {
      id: this.id,
      plantType: this.plantType,
      capacity: this.capacity,
      plantCount: Object.keys(this.plants).length,
      nutrientDemand: this.nutrientDemand,
      plants: Object.values(this.plants).map(p => ({
        id: p.id,
        type: p.type,
        weeksGrown: p.weeksGrown,
        health: p.health,
        canHarvest: p.canHarvest()
      }))
    };
  }
}

module.exports = { GrowBed };
