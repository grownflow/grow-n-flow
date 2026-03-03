const isPlainObject = require('lodash.isplainobject');

function isSerializable(value) {
  if (value === undefined || value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return true;
  if (!isPlainObject(value) && !Array.isArray(value)) return false;
  for (const key in value) {
    if (!isSerializable(value[key])) return false;
  }
  return true;
}

function findNonSerializable(obj, path) {
  if (obj === undefined || obj === null || typeof obj === 'boolean' || typeof obj === 'number' || typeof obj === 'string') return;
  if (!isPlainObject(obj) && !Array.isArray(obj)) {
    console.log('NOT SERIALIZABLE at "' + path + '":', typeof obj, obj && obj.constructor ? obj.constructor.name : '');
    return;
  }
  for (const key in obj) {
    findNonSerializable(obj[key], path + '.' + key);
  }
}

const { AquaponicsGame } = require('./src/game/game');
const G = AquaponicsGame.setup();

console.log('--- Initial state check ---');
findNonSerializable(G, 'G');
console.log('Initial serializable:', isSerializable(G));

// Simulate progressTurn the way boardgame.io v0.50 does
// In v0.50 moves receive (G, ctx, ...args) directly
console.log('');
console.log('--- After progressTurn ---');
const ctx = { currentPlayer: '0', numPlayers: 1, turn: 1, phase: null };
const result = AquaponicsGame.moves.progressTurn(G, ctx);
const stateToCheck = result !== undefined ? result : G;
findNonSerializable(stateToCheck, 'G');
console.log('After move serializable:', isSerializable(stateToCheck));
