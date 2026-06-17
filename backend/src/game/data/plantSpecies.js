/*
 *
 *
 * Plant species
 * 
 * Leafy greens (kale, lettuce):
 * Density - 20-25 plants / m^2
 * Nutrition needs - 40-60g of fish food / m^2 per day. 32% protein diet.
 * Harvest time - 3 to 5 weeks after transplant, 6 to 8 weeks from seed
 * 
 * Fruiting crops (tomatoes, cucumbers):
 * Density - 4 plants / m^2
 * Nutrition needs - 60 - 100 g of fish food / m^2 per day. 32% protein diet
 * Harvest time - 10 to 16 weeks
 * 
 * Ex: Parris Island Romaine:
 * Density - 16 plants / m^2
 * Growth Period - 4 weeks
 * Value:
 * $/head - 2.00
 * $/m^2 - 32.00
 * $/m^2 per week - 8.00
 * 
 * See more on Nutrient needs_growth sheet in Game scenarios_backstories_technical component decisions Excel file
 */

const plantSpecies = {
    Rosemary: {
        density: 12,
        growthPeriod: 10,
        category: 'herb',
        nutritionNeeds: 35,
        proteinRequirement: 28,
        valuePerHead: 4.40,   // raised from $3.50
        seedCost: 0.50,
        valuePerM2: 52.80,
        valuePerM2PerWeek: 5.28,
        tempRange: { min: 15, max: 30, optimal: { min: 18, max: 24 } },
        pHRange: { min: 6.0, max: 7.0, optimal: 6.5 },
        lightHours: 14,
        harvestWeight: 80,
        seedToTransplant: 3,
        transplantToHarvest: 7,
        totalGrowthTime: 10,
        marketAcceptance: 'good',
        shelfLife: 14,
        availability: 'year-round',
        renderAsset: 'plants/rosemary_t.glb',
        renderScale: 1.2,
        nutrientRequirements: {
            nitrogen: 4,
            phosphorus: 2,
            potassium: 25,
            calcium: 40,
            magnesium: 12,
            iron: 0.8
        },
        deficiencySymptoms: {
            nitrogen: 'yellowing_leaves',
            phosphorus: 'burnt_edges',
            potassium: 'scorched_margins_with_black_spots',
            calcium: 'tip_burn_and_deformed_leaves',
            magnesium: 'chlorosis_on_old_leaves',
            iron: 'chlorosis_on_new_leaves'
        }
    },
    Basil: {
        density: 18,
        growthPeriod: 5,
        category: 'herb',
        nutritionNeeds: 45,
        proteinRequirement: 30,
        valuePerHead: 3.10,   // raised from $2.50
        seedCost: 0.25,
        valuePerM2: 55.80,
        valuePerM2PerWeek: 11.16,
        tempRange: { min: 18, max: 32, optimal: { min: 22, max: 28 } },
        pHRange: { min: 6.0, max: 7.0, optimal: 6.5 },
        lightHours: 14,
        harvestWeight: 60,
        seedToTransplant: 2,
        transplantToHarvest: 3,
        totalGrowthTime: 5,
        marketAcceptance: 'excellent',
        shelfLife: 7,
        availability: 'year-round',
        renderAsset: 'plants/basil_t.glb',
        renderScale: 1.2,
        nutrientRequirements: {
            nitrogen: 5,
            phosphorus: 2,
            potassium: 28,
            calcium: 45,
            magnesium: 12,
            iron: 0.8
        },
        deficiencySymptoms: {
            nitrogen: 'yellowing_leaves',
            phosphorus: 'burnt_edges',
            potassium: 'scorched_margins_with_black_spots',
            calcium: 'tip_burn_and_deformed_leaves',
            magnesium: 'chlorosis_on_old_leaves',
            iron: 'chlorosis_on_new_leaves'
        }
    },
    Tomato: {
        density: 4,
        growthPeriod: 14,
        category: 'fruiting',
        nutritionNeeds: 80,
        proteinRequirement: 32,
        valuePerHead: 4.40,   // raised from $3.50
        seedCost: 0.60,
        valuePerM2: 17.60,
        valuePerM2PerWeek: 1.26,
        tempRange: { min: 16, max: 30, optimal: { min: 20, max: 26 } },
        pHRange: { min: 5.8, max: 6.8, optimal: 6.3 },
        lightHours: 16,
        harvestWeight: 500,
        seedToTransplant: 3,
        transplantToHarvest: 11,
        totalGrowthTime: 14,
        marketAcceptance: 'excellent',
        shelfLife: 10,
        availability: 'year-round',
        renderAsset: 'plants/green_tom_t.glb',
        renderScale: 1.4,
        nutrientRequirements: {
            nitrogen: 6,
            phosphorus: 4,
            potassium: 40,
            calcium: 60,
            magnesium: 18,
            iron: 1.2
        },
        deficiencySymptoms: {
            nitrogen: 'yellowing_leaves',
            phosphorus: 'burnt_edges',
            potassium: 'scorched_margins_with_black_spots',
            calcium: 'blossom_end_rot',
            magnesium: 'chlorosis_on_old_leaves',
            iron: 'chlorosis_on_new_leaves'
        }
    },
    Pepper: {
        density: 5,
        growthPeriod: 15,
        category: 'fruiting',
        nutritionNeeds: 75,
        proteinRequirement: 32,
        valuePerHead: 3.10,   // raised from $2.50
        seedCost: 0.55,
        valuePerM2: 15.50,
        valuePerM2PerWeek: 1.03,
        tempRange: { min: 18, max: 32, optimal: { min: 22, max: 28 } },
        pHRange: { min: 6.0, max: 7.0, optimal: 6.5 },
        lightHours: 14,
        harvestWeight: 200,
        seedToTransplant: 4,
        transplantToHarvest: 11,
        totalGrowthTime: 15,
        marketAcceptance: 'good',
        shelfLife: 14,
        availability: 'year-round',
        renderAsset: 'plants/pepper1_t.glb',
        renderScale: 1.3,
        nutrientRequirements: {
            nitrogen: 5,
            phosphorus: 3,
            potassium: 35,
            calcium: 55,
            magnesium: 15,
            iron: 1.0
        },
        deficiencySymptoms: {
            nitrogen: 'yellowing_leaves',
            phosphorus: 'burnt_edges',
            potassium: 'scorched_margins_with_black_spots',
            calcium: 'tip_burn_and_deformed_leaves',
            magnesium: 'chlorosis_on_old_leaves',
            iron: 'chlorosis_on_new_leaves'
        }
    },
    ParrisIslandRomaine: {
        density: 16,
        growthPeriod: 4,
        category: 'leafy_green',
        nutritionNeeds: 50,
        proteinRequirement: 32,
        valuePerHead: 3.10,   // raised from $2.50
        seedCost: 0.30, // Cost per seed
        valuePerM2: 49.60,
        valuePerM2PerWeek: 12.40,
        tempRange: { min: 10, max: 24, optimal: { min: 15, max: 20 } },
        pHRange: { min: 6.0, max: 7.0, optimal: 6.5 },
        lightHours: 12,
        harvestWeight: 300,
        seedToTransplant: 2,
        transplantToHarvest: 4,
        totalGrowthTime: 6,
        marketAcceptance: 'excellent',
        shelfLife: 7,
        availability: 'year-round',
        renderAsset: 'plants/lettuce1.glb',
        renderScale: 1.5,
        // Nutrient requirements (mg/L minimum thresholds)
        nutrientRequirements: {
            nitrogen: 5,      // Nitrate-nitrogen (NO3-N)
            phosphorus: 3,    // P
            potassium: 30,    // K
            calcium: 50,      // Ca
            magnesium: 15,    // Mg
            iron: 1           // Fe
        },
        // Deficiency symptoms for visual feedback
        deficiencySymptoms: {
            nitrogen: 'yellowing_leaves',
            phosphorus: 'burnt_edges',
            potassium: 'scorched_margins_with_black_spots',
            calcium: 'tip_burn_and_deformed_leaves',
            magnesium: 'chlorosis_on_old_leaves',
            iron: 'chlorosis_on_new_leaves'
        }
    }
};

module.exports = { plantSpecies };
