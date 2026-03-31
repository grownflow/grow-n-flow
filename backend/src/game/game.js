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
    water: {
      temperature: 25,
      pH: 7.0,
      ammonia: 0,
      nitrite: 0,
      nitrate: 0,
      dissolvedOxygen: 8,
      phosphorus: 0,
      potassium: 0,
      calcium: 40,
      magnesium: 10,
      iron: 0.1
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

    // Game mechanics and player resources
    gameTime: 0,    // DAYS since game start
    money: 5000,    // Player currency for purchases and upgrades
    
    // Utility bills tracking
    billsAccrued: {
      electricity: 0, // Accumulated electricity costs
      water: 0        // Accumulated water costs
    },
    lastBillPaid: 0   // Game day of last bill payment
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