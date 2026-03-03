const { plantSpecies } = require('../data/plantSpecies');

class Plant {
  constructor(id, type) {
    this.id = id;
    this.type = type;
    this.species = plantSpecies[type];
    if (!this.species) {
      throw new Error(`Unknown plant species: ${type}`);
    }
    
    this.size = 1;
    this.health = 100;
    this.daysGrown = 0; // Days since planting
    this.weeksGrown = 0; // Calculated from daysGrown
    this.maturity = 0; // 0 to 100%
    this.deficiencies = []; // Array of active deficiency symptoms
  }

  grow(waterChemistry, lightAvailable = true) {
    // Check if light is available (events can disable lights)
    if (!lightAvailable) {
      return {
        success: false,
        reason: 'No light available',
        growthRate: 0,
        deficiencies: this.deficiencies
      };
    }

    let growthRate = 1.0; // Base growth rate (100%)
    const newDeficiencies = [];
    const nutrientPenalties = {};

    // Check pH - optimal range for Romaine is 6.5-6.8
    const optimalPH = this.species.pHRange.optimal || 6.5;
    const pHDeviation = Math.abs(waterChemistry.pH - optimalPH);
    let pHPenalty = 0;
    
    if (pHDeviation > 1.0) {
      pHPenalty = 0.3; // 30% reduction
    } else if (pHDeviation > 0.5) {
      pHPenalty = 0.15; // 15% reduction
    }
    
    growthRate -= pHPenalty;

    // Check nutrient levels against requirements
    const requirements = this.species.nutrientRequirements;
    const symptoms = this.species.deficiencySymptoms;

    // Nitrogen (from nitrate)
    if (waterChemistry.nitrate < requirements.nitrogen) {
      const deficitRatio = waterChemistry.nitrate / requirements.nitrogen;
      const penalty = (1 - deficitRatio) * 0.4; // Up to 40% reduction
      nutrientPenalties.nitrogen = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'nitrogen',
        symptom: symptoms.nitrogen,
        severity: penalty > 0.3 ? 'severe' : penalty > 0.15 ? 'moderate' : 'mild'
      });
    }

    // Phosphorus
    if (waterChemistry.phosphorus < requirements.phosphorus) {
      const deficitRatio = waterChemistry.phosphorus / requirements.phosphorus;
      const penalty = (1 - deficitRatio) * 0.3; // Up to 30% reduction
      nutrientPenalties.phosphorus = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'phosphorus',
        symptom: symptoms.phosphorus,
        severity: penalty > 0.2 ? 'severe' : penalty > 0.1 ? 'moderate' : 'mild'
      });
    }

    // Potassium
    if (waterChemistry.potassium < requirements.potassium) {
      const deficitRatio = waterChemistry.potassium / requirements.potassium;
      const penalty = (1 - deficitRatio) * 0.3; // Up to 30% reduction
      nutrientPenalties.potassium = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'potassium',
        symptom: symptoms.potassium,
        severity: penalty > 0.2 ? 'severe' : penalty > 0.1 ? 'moderate' : 'mild'
      });
    }

    // Calcium
    if (waterChemistry.calcium < requirements.calcium) {
      const deficitRatio = waterChemistry.calcium / requirements.calcium;
      const penalty = (1 - deficitRatio) * 0.25; // Up to 25% reduction
      nutrientPenalties.calcium = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'calcium',
        symptom: symptoms.calcium,
        severity: penalty > 0.15 ? 'severe' : penalty > 0.08 ? 'moderate' : 'mild'
      });
    }

    // Magnesium
    if (waterChemistry.magnesium < requirements.magnesium) {
      const deficitRatio = waterChemistry.magnesium / requirements.magnesium;
      const penalty = (1 - deficitRatio) * 0.2; // Up to 20% reduction
      nutrientPenalties.magnesium = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'magnesium',
        symptom: symptoms.magnesium,
        severity: penalty > 0.12 ? 'severe' : penalty > 0.06 ? 'moderate' : 'mild'
      });
    }

    // Iron
    if (waterChemistry.iron < requirements.iron) {
      const deficitRatio = waterChemistry.iron / requirements.iron;
      const penalty = (1 - deficitRatio) * 0.25; // Up to 25% reduction
      nutrientPenalties.iron = penalty;
      growthRate -= penalty;
      newDeficiencies.push({
        nutrient: 'iron',
        symptom: symptoms.iron,
        severity: penalty > 0.15 ? 'severe' : penalty > 0.08 ? 'moderate' : 'mild'
      });
    }

    // Ensure growth rate doesn't go negative
    growthRate = Math.max(0, growthRate);

    // Update plant state (one day of growth)
    this.daysGrown += 1;
    this.weeksGrown = Math.floor(this.daysGrown / 7); // Update weeks for UI
    this.maturity += (100 / (this.species.growthPeriod * 7)) * growthRate; // Growth over total days
    this.maturity = Math.min(100, this.maturity);
    
    // Health decreases with deficiencies
    const totalPenalty = Object.values(nutrientPenalties).reduce((sum, p) => sum + p, 0) + pHPenalty;
    this.health = Math.max(0, this.health - (totalPenalty * 10));
    
    this.deficiencies = newDeficiencies;

    return {
      success: true,
      growthRate: Number(growthRate.toFixed(2)),
      maturity: Number(this.maturity.toFixed(1)),
      health: Number(this.health.toFixed(1)),
      weeksGrown: this.weeksGrown,
      deficiencies: this.deficiencies,
      pHPenalty: Number(pHPenalty.toFixed(2)),
      nutrientPenalties
    };
  }

  canHarvest() {
    // Check if plant has grown for the full growth period (in days)
    const daysRequired = this.species.growthPeriod * 7;
    return this.daysGrown >= daysRequired;
  }

  getMarketValue() {
    // Market value reduced by health damage
    const healthMultiplier = this.health / 100;
    return this.canHarvest() ? this.species.valuePerHead * healthMultiplier : 0;
  }

  harvest() {
    // TODO: Future inventory system
    // When implemented, this should:
    // - Add plant to player inventory with shelf life countdown
    // - Track quantity and weight
    // - Enable player to bundle for sale or use in recipes
    
    if (!this.canHarvest()) {
      return {
        success: false,
        reason: 'Plant not ready for harvest',
        value: 0
      };
    }

    const harvestValue = this.getMarketValue();

    return {
      success: true,
      value: harvestValue,
      type: this.type,
      quantity: 1,
      health: this.health,
      quality: this.health >= 80 ? 'excellent' : this.health >= 60 ? 'good' : this.health >= 40 ? 'fair' : 'poor'
      // TODO: Add to inventory system future
      // inventory: { type: this.type, quantity: 1, shelfLife: this.species.shelfLife }
    };
  }
}

module.exports = { Plant };
