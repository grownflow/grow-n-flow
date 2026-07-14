// Main game definition for boardgame.io
// Imports moves from modular files and defines core game structure

// Import all moves from the moves directory
const moves = require('./moves');

// Helper to create initial serializable aquaponics system state
// boardgame.io requires all state to be JSON-serializable (no class instances)
const createInitialSystemState = () => ({
  id: `system_${Date.now()}`,
  tank: {
    id: `tank_${Date.now()}`,
    capacity: 1000,
    currentVolume: 1000,
    foodInTank: 0,
    sediment: 0,
    // Biofilter starts at 55%: reflects a partially seeded system (common in real
    // aquaponics where starter media from an established system is used).
    // runOneTurn auto-increments this toward 80% over the first 14 game days.
    biofilterEfficiency: 0.55,
    water: {
      temperature: 25,
      pH: 7.0,
      ammonia: 0,
      nitrite: 0,
      nitrate: 5,      // small baseline so plants have some initial nutrients
      dissolvedOxygen: 8,
      phosphorus: 2,   // baseline to avoid immediate plant stress
      potassium: 10,   // baseline to avoid immediate plant stress
      calcium: 40,
      magnesium: 10,
      iron: 2.0        // above the 1.0 mg/L threshold so plants don't take iron-deficiency damage from day 1
    }
  },
  growBeds: {},
  light: {
    id: `light_${Date.now()}`,
    isOn: true,
    intensity: 100,
    hoursOn: 0
  },
  log: []
});

const AquaponicsGame = {
  // Game identifier - used in API endpoints (/games/aquaponics/...)
  name: "aquaponics",
  
  // Initial game state when a new game is created
  // This represents a fresh aquaponics system with no fish or plants
  // All state must be plain JSON objects (no class instances with methods)
  setup: () => ({
    // Individual entities as arrays - each fish/plant is a separate object
    fish: [],     // Array of fish objects with individual properties
    plants: [],   // Array of plant objects in various grow beds
    maxPlantSlots: 0,
    
    // Core aquaponics system state (plain object, not class instance)
    aquaponicsSystem: createInitialSystemState(),

    // Player inventory
    fishFood: 0,    // units of fish food (10 units per pack purchased)

    // Game mechanics and player resources
    gameTime: 0,    // DAYS since game start
    money: 1000,    // Player currency for purchases and upgrades

    // Settings
    autoFeed: true, // automatically feed fish from inventory each day during Progress

    // Purchased equipment / supplies (counts by key from data/equipment.js)
    // New players start with 1 free biofilter unit so they can see how it works.
    equipment: { biofilter: 1 },

    // Player-held inventory (harvested goods, etc.)
    inventory: {
      produce: {}
    },
    
    // Utility bills tracking
    billsAccrued: {
      electricity: 0, // Accumulated electricity costs
      water: 0        // Accumulated water costs
    },
    lastBillPaid: 0,  // Game day of last bill payment

    // Ecosystem quality tracking
    stableEcosystemDays:    0,     // consecutive days with optimal water chemistry
    stableEcosystemRewarded: false, // true once the one-time $100 stable ecosystem reward has been paid
    highestMilestoneMoney:  0,     // highest success milestone ($1500/$2500/$5000) reached
    fishDeathsThisPeriod:   0,     // fish deaths in the current 30-day billing window (reset each cycle)
  }),

  // Import all moves from the modular move files
  // This keeps the main game file clean while allowing complex move logic
  moves
  // Turn structure and phases can be added here as the game grows
  // turn: { ... }, only need turns if multiplayer added.
  // phases: { ... }, used for diff game states that allow diff moves
};

// Export the game so it can be used by the boardgame.io server
module.exports = { AquaponicsGame };