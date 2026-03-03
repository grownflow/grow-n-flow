class WaterChemistry {
  constructor() {
    // Nitrogen cycle
    this.ammonia = 0;
    this.nitrite = 0;
    this.nitrate = 10;
    
    // Water parameters
    this.pH = 7.0;
    this.temperature = 22;
    this.dissolvedOxygen = 8.0;
    
    // Plant nutrients (from fish feed breakdown and supplements)
    this.phosphorus = 5;      // mg/L (P)
    this.potassium = 40;      // mg/L (K) 
    this.calcium = 60;        // mg/L (Ca)
    this.magnesium = 20;      // mg/L (Mg)
    this.iron = 2;            // mg/L (Fe)
  }

  update(ammoniaInput, plantAbsorption, biofilterEfficiency) {
    this.ammonia += ammoniaInput;
    this.nitrite = this.ammonia * biofilterEfficiency;
    this.nitrate += this.nitrite * biofilterEfficiency;
    this.ammonia = 0;
    this.nitrite = 0;
    this.pH -= 0.01 * (ammoniaInput - plantAbsorption);
    this.pH = Math.max(6.0, Math.min(8.0, this.pH));
  }

  getStatus() {
    return {
      ammonia: Number(this.ammonia.toFixed(2)),
      nitrite: Number(this.nitrite.toFixed(2)),
      nitrate: Number(this.nitrate.toFixed(2)),
      pH: Number(this.pH.toFixed(1)),
      temperature: Number(this.temperature.toFixed(1)),
      dissolvedOxygen: Number(this.dissolvedOxygen.toFixed(1)),
      phosphorus: Number(this.phosphorus.toFixed(1)),
      potassium: Number(this.potassium.toFixed(1)),
      calcium: Number(this.calcium.toFixed(1)),
      magnesium: Number(this.magnesium.toFixed(1)),
      iron: Number(this.iron.toFixed(2))
    };
  }
}

module.exports = { WaterChemistry };
