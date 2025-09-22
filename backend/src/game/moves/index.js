// Central export file for all game moves
// This file imports and combines all move categories into one object
// that can be easily imported by the main game definition

const fishMoves = require('./fishMoves');
const plantMoves = require('./plantMoves');
const waterMoves = require('./waterMoves');
const economyMoves = require('./economyMoves');

// Combine all move objects using spread operator
// This allows game.js to import all moves with: const moves = require('./moves')
module.exports = {
  ...fishMoves,
  ...plantMoves,
  ...waterMoves,
  ...economyMoves
};