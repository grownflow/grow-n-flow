/*
 * "Moves" are the API contract
 * Frontend team will use these to implement actions
 * (feed fish, plant seed, progress turn, etc)
 */

const fishMoves = require('./fishMoves');
const plantMoves = require('./plantMoves');
const economyMoves = require('./economyMoves');
const systemMoves = require('./systemMoves');


// Central export file for all game moves
// This file imports and combines all move categories into one object
// that can be easily imported by the main game definition
// Combine all move objects using spread operator
// This allows game.js to import all moves with: const moves = require('./moves')
module.exports = {
  ...fishMoves,
  ...plantMoves,
  ...economyMoves,
  ...systemMoves
};