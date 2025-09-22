// Main game definition for boardgame.io
// Imports moves from modular files and defines core game structure

// Import all moves from the moves directory
const moves = require('./moves');

const AquaponicsGame = {
  // Game identifier - used in API endpoints (/games/aquaponics/...)
  name: "aquaponics",
  
  // Initial game state when a new game is created
  // This represents a fresh aquaponics system with no fish or plants
  setup: () => ({
    // Individual entities as arrays - each fish/plant is a separate object
    fish: [],     // Array of fish objects with individual properties
    plants: [],   // Array of plant objects in various grow beds
    
    // System-wide parameters that affect all entities
    waterSystem: {
        temperature: 24,    // Celsius - affects fish health and plant growth
        ph: 7.0,           // pH level - critical for both fish and plants
        ammonia: 0,        // Toxic to fish - produced by fish waste
        nitrite: 0,        // Intermediate in nitrogen cycle
        nitrate: 20,       // Plant nutrient - end product of nitrogen cycle
        oxygenLevel: 8.0   // Dissolved oxygen - critical for fish survival
    },

    // Game mechanics and player resources
    gameTime: 0,    // Hours since game start - used for growth calculations
    money: 500      // Player currency for purchases and upgrades
  }),

  // Import all moves from the modular move files
  // This keeps the main game file clean while allowing complex move logic
  moves

  // Turn structure and phases can be added here as the game grows
  // turn: { ... }
  // phases: { ... }
  // endIf: { ... }
};

// Export the game so it can be used by the boardgame.io server
module.exports = { AquaponicsGame };