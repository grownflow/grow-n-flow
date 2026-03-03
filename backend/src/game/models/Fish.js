const { fishSpecies } = require('../data/fishSpecies');
const { EnvironmentalStress } = require('../utils/environmentalStress');

// revisit size mechanics to match weight (g) more closely

class Fish {
  constructor(type, count) {
    this.type = type;
    this.count = count;
    this.health = 10;
    this.size = 1.0;
    this.age = 0;
    
    // Get species parameters
    this.species = fishSpecies[type.toLowerCase()];
    if (!this.species) {
      throw new Error(`Unknown fish species: ${type}`);
    }
    
    // Set species-specific rates
    this.ammoniaProductionRate = this.species.ammoniaProductionRate;
    this.foodConsumptionRate = this.species.foodConsumptionRate;
    this.growthRate = this.species.baseGrowthRate;
  }

  feed(foodAvailable, waterConditions = {}) {
    const { temperature = 25, ammonia = 0, oxygen = 8 } = waterConditions;
    
    const requiredFood = this.count * this.foodConsumptionRate;
    const foodRatio = Math.min(foodAvailable / requiredFood, 1);
    
    // Calculate environmental stress
    const stress = EnvironmentalStress.calculateOverallStress(
      temperature, ammonia, oxygen, this.species
    );
    
    const stressFactor = 1 - stress.overall;
    const growth = this.growthRate * foodRatio * stressFactor * this.count;
    
    this.size += growth;
    this.age += 1;

    // Update health
    if (foodRatio < 0.8 || stress.overall > 0.3) {
      const healthLoss = (1 - foodRatio) * 2 + stress.overall * 3;
      this.health -= healthLoss;
    } else {
      this.health = Math.min(10, this.health + 0.5);
    }

    this.health = Math.max(1, this.health);
    
    return {
      foodUsed: requiredFood * foodRatio,
      growth: growth,
      stressFactor: stressFactor,
      stress: stress
    };
  }

  produceWaste() {
    const sizeMultiplier = this.size / 1.0;
    return this.count * this.ammoniaProductionRate * sizeMultiplier;
  }

  isHarvestable() {
    return this.size >= this.species.harvestWeight * 0.8;
  }

  getMarketValue() {
    if (!this.isHarvestable()) return 0;
    
    const weightInPounds = (this.size / 1000) * 2.20462;
    const healthMultiplier = this.health / 10;
    
    return this.count * weightInPounds * this.species.marketValue * healthMultiplier;
  }
}

module.exports = { Fish };