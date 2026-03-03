const { AquaponicsSystem } = require('../models/AquaponicsSystem');

function ensureSystem(G) {
  if (!G.aquaponicsSystem) {
    G.aquaponicsSystem = new AquaponicsSystem();
  }
  return G.aquaponicsSystem;
}

module.exports = { ensureSystem };