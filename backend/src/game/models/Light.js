class Light {
  constructor() {
    this.id = `light_${Date.now()}`;
    this.hoursPerDay = 16; // Typical grow lights
    this.intensityPAR = 300; // Photosynthetic Active Radiation (µmol/m²/s)
    this.isOn = true;
    this.costPerHour = 0.05; // $ per hour of operation
  }

  setPhotoperiod(hours) {
    if (hours < 0 || hours > 24) {
      return { success: false, error: 'Hours must be 0-24' };
    }
    this.hoursPerDay = hours;
    return { success: true, hoursPerDay: this.hoursPerDay };
  }

  setIntensity(par) {
    if (par < 0) {
      return { success: false, error: 'PAR cannot be negative' };
    }
    this.intensityPAR = par;
    return { success: true, intensityPAR: this.intensityPAR };
  }

  getDailyCost() {
    return Number((this.hoursPerDay * this.costPerHour).toFixed(2));
  }

  getGrowthMultiplier() {
    // Light intensity affects plant growth
    // Base is 300 PAR = 1.0x multiplier
    // More light = faster growth
    const baseIntensity = 300;
    return Math.min(this.intensityPAR / baseIntensity, 2.0); // Cap at 2x
  }

  getStatus() {
    return {
      id: this.id,
      hoursPerDay: this.hoursPerDay,
      intensityPAR: this.intensityPAR,
      isOn: this.isOn,
      dailyCost: this.getDailyCost(),
      growthMultiplier: Number(this.getGrowthMultiplier().toFixed(2))
    };
  }
}

module.exports = { Light };
