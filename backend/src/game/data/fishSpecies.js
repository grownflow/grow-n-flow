// two fish species: tilapia barramundi
  // params: temp (C) vital and optimal, total ammonia nitrogen (mg/L), dissolved oxygen (mg/L) crude protein in feed (%)
  // growth rate (avg weight in time to harvest), fingerling availability, market value ($US/lb), consumer acceptance (?)
  // tilapia: 4-34, 25-30, < 2, < 1, > 4, 28-32, 600g in 6-8 months, year-round, $3.00, good?
  // barramundi: 18-34, 26-29, <1, <1, >4, 38-45, 400g in 9-10 months, seasonal, $8.00-9.00, yes, good

// change months stats to days

const fishSpecies = {
  tilapia: {
    tempRange: { min: 4, max: 34, optimal: { min: 25, max: 30 } },
    ammoniaToleranceMax: 2.0,
    oxygenMin: 4.0,
    proteinRequirement: { min: 28, max: 32 },
    harvestWeight: 600,
    harvestTime: 210, // in days
    baseGrowthRate: 600 / 210, // ~2.86 per day
    marketValue: 3.00,
    fingerlingCost: 2.50, // Cost per fingerling
    availability: 'year-round',
    consumerAcceptance: 'good',
    ammoniaProductionRate: 0.1,
    foodConsumptionRate: 0.2,
    renderAsset: '3d/Redheadx.x3d',
    renderScale: 0.3,
  },
  
  barramundi: {
    tempRange: { min: 18, max: 34, optimal: { min: 26, max: 29 } },
    ammoniaToleranceMax: 1.0,
    oxygenMin: 4.0,
    proteinRequirement: { min: 38, max: 45 },
    harvestWeight: 400,
    harvestTime: 285, // in days
    baseGrowthRate: 400 / 285, // ~1.40 per day
    marketValue: 8.50,
    fingerlingCost: 6.00, // Cost per fingerling
    availability: 'seasonal',
    consumerAcceptance: 'good',
    ammoniaProductionRate: 0.08,
    foodConsumptionRate: 0.25,
    renderAsset: '3d/Barramundi.x3d',
    renderScale: 0.4,
  },

  catfish: {
    tempRange: { min: 20, max: 32, optimal: { min: 24, max: 29 } },
    ammoniaToleranceMax: 1.5,
    oxygenMin: 4.0,
    proteinRequirement: { min: 30, max: 36 },
    harvestWeight: 700,
    harvestTime: 240,
    baseGrowthRate: 700 / 240,
    marketValue: 4.00,
    fingerlingCost: 3.50,
    availability: 'year-round',
    consumerAcceptance: 'good',
    ammoniaProductionRate: 0.11,
    foodConsumptionRate: 0.22,
    renderAsset: '3d/Gigi.x3d',
    renderScale: 0.5,
  }
};

module.exports = { fishSpecies };