class EnvironmentalStress {
  static clampNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  static calculateTemperatureStress(temperature, tempRange) {
    const { min, max, optimal } = tempRange;
    
    if (temperature < min || temperature > max) return 1.0;
    if (temperature >= optimal.min && temperature <= optimal.max) return 0.0;
    
    if (temperature < optimal.min) {
      return (optimal.min - temperature) / (optimal.min - min);
    } else {
      return (temperature - optimal.max) / (max - optimal.max);
    }
  }

  static calculateAmmoniaStress(ammonia, tolerance, pH = 7.0, temperature = 25) {
    // Ammonia toxicity increases with higher pH and warmer water because more NH3 is present.
    const pHFactor = Math.max(0, pH - 7.0) * 0.25;
    const tempFactor = Math.max(0, temperature - 25) * 0.03;
    const effectiveAmmonia = this.clampNumber(ammonia * (1 + pHFactor + tempFactor), 0, 1000);

    if (effectiveAmmonia <= 0.5) return 0.0;
    if (effectiveAmmonia >= tolerance) return 1.0;
    return (effectiveAmmonia - 0.5) / (tolerance - 0.5);
  }

  static calculateNitriteStress(nitrite, tolerance = 1.0) {
    if (nitrite <= 0.2) return 0.0;
    if (nitrite >= tolerance) return 1.0;
    return (nitrite - 0.2) / (tolerance - 0.2);
  }

  static calculateOxygenStress(oxygen, minimum) {
    const effectiveMinimum = Math.max(Number(minimum) || 0, 5.0);
    if (oxygen >= effectiveMinimum) return 0.0;
    if (oxygen <= 2.0) return 1.0;
    return (effectiveMinimum - oxygen) / (effectiveMinimum - 2.0);
  }

  static calculateOverallStress(temperature, ammonia, oxygen, species, pH = 7.0, nitrite = 0) {
    const tempStress = this.calculateTemperatureStress(temperature, species.tempRange);
    const ammoniaStress = this.calculateAmmoniaStress(ammonia, species.ammoniaToleranceMax, pH, temperature);
    const nitriteStress = this.calculateNitriteStress(nitrite, species.nitriteToleranceMax ?? 1.0);
    const oxygenStress = this.calculateOxygenStress(oxygen, species.oxygenMin);
    
    return {
      temperature: tempStress,
      ammonia: ammoniaStress,
      nitrite: nitriteStress,
      oxygen: oxygenStress,
      overall: (tempStress + ammoniaStress + nitriteStress + oxygenStress) / 4
    };
  }
}

module.exports = { EnvironmentalStress };