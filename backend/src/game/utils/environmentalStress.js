class EnvironmentalStress {
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

  static calculateAmmoniaStress(ammonia, tolerance) {
    if (ammonia <= 0.5) return 0.0;
    if (ammonia >= tolerance) return 1.0;
    return (ammonia - 0.5) / (tolerance - 0.5);
  }

  static calculateOxygenStress(oxygen, minimum) {
    if (oxygen >= minimum) return 0.0;
    if (oxygen <= 2.0) return 1.0;
    return (minimum - oxygen) / (minimum - 2.0);
  }

  static calculateOverallStress(temperature, ammonia, oxygen, species) {
    const tempStress = this.calculateTemperatureStress(temperature, species.tempRange);
    const ammoniaStress = this.calculateAmmoniaStress(ammonia, species.ammoniaToleranceMax);
    const oxygenStress = this.calculateOxygenStress(oxygen, species.oxygenMin);
    
    return {
      temperature: tempStress,
      ammonia: ammoniaStress,
      oxygen: oxygenStress,
      overall: (tempStress + ammoniaStress + oxygenStress) / 3
    };
  }
}

module.exports = { EnvironmentalStress };