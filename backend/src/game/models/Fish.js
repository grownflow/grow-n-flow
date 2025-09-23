class Fish {
  constructor(type, count) {
    this.type = type;
    this.count = count;
    this.ammoniaProductionRate = 0.1;
    this.foodConsumptionRate = 0.2;
    this.growthRate = 0.05;
    this.health = 10;
    this.size = 1.0;
  }

  // placeholder logic. this method will be changed. 
  feed(foodAvailable) {
    const requiredFood = this.count * this.foodConsumptionRate;
    const foodRatio = Math.min(foodAvailable / requiredFood, 1);
    const growth = this.count * this.growthRate * foodRatio;
    this.size += growth;

    if (foodRatio < 0.8) {
      this.health -= (1 - foodRatio) * 2;
    } else {
      this.health = Math.min(10, this.health + 0.5);
    }

    this.health = Math.max(1, this.health);
    
    return {
      foodUsed: requiredFood * foodRatio,
      growth: growth
    };
  }

  produceWaste() {
    return this.count * this.ammoniaProductionRate;
  }
}

module.exports = { Fish };