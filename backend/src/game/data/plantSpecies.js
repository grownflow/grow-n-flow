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
    ParrisIslandRomaine: {
        density: 16,
        growthPeriod: 4,
        category: 'leafy_green',
        nutritionNeeds: 50,
        proteinRequirement: 32,
        valuePerHead: 2.00,
        seedCost: 0.30, // Cost per seed
        valuePerM2: 32.00,
        valuePerM2PerWeek: 8.00,
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
    },

    Kale: {
        density: 24,
        growthPeriod: 5,
        category: 'leafy_green',
        nutritionNeeds: 50,
        proteinRequirement: 32,
        valuePerHead: 2.50,
        seedCost: 0.25,
        valuePerM2: 60.00,
        valuePerM2PerWeek: 12.00,
        tempRange: { min: 7, max: 24, optimal: { min: 13, max: 18 } },
        pHRange: { min: 6.0, max: 7.5, optimal: 6.8 },
        lightHours: 12,
        harvestWeight: 250,
        totalGrowthTime: 5,
        marketAcceptance: 'good',
        shelfLife: 5,
        availability: 'year-round',
        renderAsset: 'plants/lettuce1.glb',
        renderScale: 1.2,
        nutrientRequirements: {
            nitrogen: 6,
            phosphorus: 3,
            potassium: 35,
            calcium: 50,
            magnesium: 15,
            iron: 1
        },
        deficiencySymptoms: {
            nitrogen: 'yellowing_older_leaves',
            phosphorus: 'purple_tinted_leaves',
            potassium: 'brown_leaf_edges',
            calcium: 'curled_leaves_with_tip_burn',
            magnesium: 'interveinal_chlorosis',
            iron: 'yellowing_of_young_leaves'
        }
    },

    BasilSweet: {
        density: 20,
        growthPeriod: 3,
        category: 'herb',
        nutritionNeeds: 40,
        proteinRequirement: 32,
        valuePerHead: 3.00,
        seedCost: 0.35,
        valuePerM2: 60.00,
        valuePerM2PerWeek: 20.00,
        tempRange: { min: 18, max: 35, optimal: { min: 22, max: 28 } },
        pHRange: { min: 5.5, max: 7.0, optimal: 6.3 },
        lightHours: 14,
        harvestWeight: 50,
        totalGrowthTime: 3,
        marketAcceptance: 'excellent',
        shelfLife: 3,
        availability: 'year-round',
        renderAsset: 'plants/lettuce1.glb',
        renderScale: 0.8,
        nutrientRequirements: {
            nitrogen: 4,
            phosphorus: 2,
            potassium: 20,
            calcium: 40,
            magnesium: 10,
            iron: 0.8
        },
        deficiencySymptoms: {
            nitrogen: 'pale_yellow_leaves',
            phosphorus: 'small_dark_leaves',
            potassium: 'brown_leaf_margins',
            calcium: 'distorted_new_growth',
            magnesium: 'chlorosis_between_veins',
            iron: 'yellow_new_leaves_with_green_veins'
        }
    },

    CherryTomato: {
        density: 4,
        growthPeriod: 10,
        category: 'fruiting',
        nutritionNeeds: 80,
        proteinRequirement: 32,
        valuePerHead: 5.00,
        seedCost: 0.80,
        valuePerM2: 20.00,
        valuePerM2PerWeek: 2.00,
        tempRange: { min: 18, max: 32, optimal: { min: 22, max: 26 } },
        pHRange: { min: 5.8, max: 6.8, optimal: 6.3 },
        lightHours: 16,
        harvestWeight: 200,
        totalGrowthTime: 12,
        marketAcceptance: 'excellent',
        shelfLife: 7,
        availability: 'seasonal',
        renderAsset: 'plants/lettuce1.glb',
        renderScale: 2.0,
        nutrientRequirements: {
            nitrogen: 8,
            phosphorus: 5,
            potassium: 50,
            calcium: 60,
            magnesium: 20,
            iron: 1.5
        },
        deficiencySymptoms: {
            nitrogen: 'pale_green_lower_leaves',
            phosphorus: 'purple_undersides_on_leaves',
            potassium: 'brown_leaf_edges_and_poor_fruit_set',
            calcium: 'blossom_end_rot',
            magnesium: 'interveinal_chlorosis_on_lower_leaves',
            iron: 'yellowing_of_young_leaves'
        }
    }
};

module.exports = { plantSpecies };
