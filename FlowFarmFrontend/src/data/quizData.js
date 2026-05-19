export const QUIZZES = [
  {
    id: 'nitrogen_cycle',
    question: 'What toxic compound do fish produce as waste?',
    options: ['Nitrate', 'Ammonia', 'Oxygen', 'Carbon dioxide'],
    correctIndex: 1,
    explanation:
      'Fish release ammonia (NH₃) through their gills and waste. Beneficial bacteria in your biofilter convert it first to nitrite, then to plant-safe nitrate. Without a working biofilter, ammonia accumulates and becomes lethal.',
    preconditions: { minGameTime: 1, minFishCount: 1 },
  },
  {
    id: 'nitrate_plants',
    question: 'After the nitrogen cycle completes, what do plants absorb from the water?',
    options: ['Ammonia directly', 'Carbon dioxide', 'Nitrate (NO₃⁻)', 'Dissolved oxygen'],
    correctIndex: 2,
    explanation:
      'Nitrate is the end product of nitrification and the primary nitrogen fertilizer for your plants. This is the core loop of aquaponics: fish waste → bacteria → plant food. The fish feed the plants, the plants clean the water.',
    preconditions: { minGameTime: 2, minFishCount: 1, minPlantCount: 1 },
  },
  {
    id: 'dissolved_oxygen',
    question: 'What happens to dissolved oxygen as water temperature rises?',
    options: ['It increases', 'It stays the same', 'It decreases', 'It spikes then crashes'],
    correctIndex: 2,
    explanation:
      'Warmer water holds less dissolved gas — including oxygen. During a heat wave, fish breathe harder while the water holds less O₂. An air pump helps compensate, but temperature control is the real fix.',
    preconditions: { minGameTime: 3 },
  },
  {
    id: 'ideal_ph',
    question: 'What pH range keeps both fish and plants healthy in aquaponics?',
    options: ['5.0–5.5', '6.0–6.5', '6.5–7.0', '7.5–8.5'],
    correctIndex: 2,
    explanation:
      'pH 6.5–7.0 is the sweet spot. Below 6.5, iron and calcium become harder for plants to absorb. Above 7.5, ammonia becomes significantly more toxic to fish. Use buffering solutions to stay in range.',
    preconditions: { minGameTime: 4, minPlantCount: 1 },
  },
  {
    id: 'tip_burn',
    question: 'Which deficiency causes tip burn — brown, dead leaf edges — in leafy greens?',
    options: ['Nitrogen', 'Iron', 'Potassium', 'Calcium'],
    correctIndex: 3,
    explanation:
      'Calcium strengthens plant cell walls. Without enough, fast-growing leaf edges can\'t form properly — that\'s tip burn. Keep calcium above 50 mg/L and pH in range so plants can actually absorb it.',
    preconditions: { minGameTime: 5, minPlantCount: 3 },
  },
  {
    id: 'overstocking',
    question: 'Why is adding many fish too quickly dangerous?',
    options: [
      'Fish become territorial',
      'Ammonia spikes faster than bacteria can convert it',
      'Plants absorb nutrients too slowly',
      'Water temperature drops suddenly',
    ],
    correctIndex: 1,
    explanation:
      'Your biofilter bacteria colony grows slowly. Overstocking floods the system with more ammonia than the bacteria population can handle. Stock gradually and watch your ammonia — it should stay below 0.5 ppm.',
    preconditions: { minGameTime: 3, minFishCount: 3 },
  },
];

export function meetsQuizPreconditions(preconditions, G) {
  if (!preconditions) return true;
  const { minGameTime, minFishCount, minPlantCount } = preconditions;
  if (minGameTime != null && (G.gameTime ?? 0) < minGameTime) return false;
  if (minFishCount != null && (G.fish?.length ?? 0) < minFishCount) return false;
  if (minPlantCount != null && (G.plants?.length ?? 0) < minPlantCount) return false;
  return true;
}
