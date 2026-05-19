// Event Manager - handles triggering and managing game events
const { EVENTS, EVENT_TYPES } = require('../data/events');

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function ensureTankAndWater(G) {
  if (!G.aquaponicsSystem) G.aquaponicsSystem = { tank: {}, light: { isOn: true } };
  if (!G.aquaponicsSystem.tank) G.aquaponicsSystem.tank = {};
  const tank = G.aquaponicsSystem.tank;

  const capacity = Number.isFinite(Number(tank.capacity))
    ? Number(tank.capacity)
    : (Number.isFinite(Number(tank.volumeLiters)) ? Number(tank.volumeLiters) : 1000);
  tank.capacity = capacity;
  tank.volumeLiters = capacity;

  const current = Number.isFinite(Number(tank.currentVolume))
    ? Number(tank.currentVolume)
    : (Number.isFinite(Number(tank.currentWaterLevel)) ? Number(tank.currentWaterLevel) : capacity);
  tank.currentVolume = clampNumber(current, 0, capacity);
  tank.currentWaterLevel = tank.currentVolume;

  if (!tank.water) tank.water = {};
  const water = tank.water;
  water.ammonia = clampNumber(water.ammonia ?? 0, 0, 1000);
  water.nitrite = clampNumber(water.nitrite ?? 0, 0, 1000);
  water.nitrate = clampNumber(water.nitrate ?? 10, 0, 10000);
  water.pH = clampNumber(water.pH ?? 7.0, 0, 14);
  water.temperature = clampNumber(water.temperature ?? 25, -10, 60);
  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen ?? 8.0, 0, 20);
  water.phosphorus = clampNumber(water.phosphorus ?? 5, 0, 10000);
  water.potassium = clampNumber(water.potassium ?? 40, 0, 10000);
  water.calcium = clampNumber(water.calcium ?? 60, 0, 10000);
  water.magnesium = clampNumber(water.magnesium ?? 20, 0, 10000);
  water.iron = clampNumber(water.iron ?? 2, 0, 10000);

  return { tank, water };
}

function getFishCount(G) {
  return Array.isArray(G?.fish) ? G.fish.filter(Boolean).length : 0;
}

function getSediment(G) {
  const s = Number(G?.aquaponicsSystem?.tank?.sediment ?? 0);
  return Number.isFinite(s) ? s : 0;
}

function getWaterLevelFraction(G) {
  const tank = G?.aquaponicsSystem?.tank;
  const capacity = Number(tank?.capacity ?? tank?.volumeLiters ?? 0);
  const current = Number(tank?.currentVolume ?? tank?.currentWaterLevel ?? 0);
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  const cur = Number.isFinite(current) ? current : 0;
  return clampNumber(cur / capacity, 0, 1);
}

function hasRequiredEquipment(G, requiresEquipment) {
  if (!requiresEquipment || typeof requiresEquipment !== 'object') return true;
  const inv = (G && G.equipment) ? G.equipment : {};
  for (const [key, minQty] of Object.entries(requiresEquipment)) {
    const need = Number(minQty ?? 0);
    if (!Number.isFinite(need) || need <= 0) continue;
    const have = Number(inv[key] ?? 0);
    if (!Number.isFinite(have) || have < need) return false;
  }
  return true;
}

function meetsPreconditions(G, eventDef) {
  const p = eventDef?.preconditions;
  if (!p || typeof p !== 'object') return true;

  const day = Number(G?.gameTime ?? 0);
  if (Number.isFinite(Number(p.minDay)) && day < Number(p.minDay)) return false;
  if (Number.isFinite(Number(p.maxDay)) && day > Number(p.maxDay)) return false;

  const fishCount = getFishCount(G);
  if (Number.isFinite(Number(p.minFishCount)) && fishCount < Number(p.minFishCount)) return false;
  if (Number.isFinite(Number(p.maxFishCount)) && fishCount > Number(p.maxFishCount)) return false;

  const sediment = getSediment(G);
  if (Number.isFinite(Number(p.minSediment)) && sediment < Number(p.minSediment)) return false;
  if (Number.isFinite(Number(p.maxSediment)) && sediment > Number(p.maxSediment)) return false;

  const wfrac = getWaterLevelFraction(G);
  if (Number.isFinite(Number(p.minWaterLevelFraction)) && wfrac < Number(p.minWaterLevelFraction)) return false;
  if (Number.isFinite(Number(p.maxWaterLevelFraction)) && wfrac > Number(p.maxWaterLevelFraction)) return false;

  // Water-chemistry thresholds. Example:
  // preconditions: { minWater: { ammonia: 1.0 }, maxWater: { dissolvedOxygen: 5.0 } }
  const water = G?.aquaponicsSystem?.tank?.water || {};
  if (p.minWater && typeof p.minWater === 'object') {
    for (const [key, minVal] of Object.entries(p.minWater)) {
      const minN = Number(minVal);
      if (!Number.isFinite(minN)) continue;
      const cur = Number(water?.[key]);
      const curN = Number.isFinite(cur) ? cur : 0;
      if (curN < minN) return false;
    }
  }
  if (p.maxWater && typeof p.maxWater === 'object') {
    for (const [key, maxVal] of Object.entries(p.maxWater)) {
      const maxN = Number(maxVal);
      if (!Number.isFinite(maxN)) continue;
      const cur = Number(water?.[key]);
      const curN = Number.isFinite(cur) ? cur : 0;
      if (curN > maxN) return false;
    }
  }

  if (!hasRequiredEquipment(G, p.requiresEquipment)) return false;

  return true;
}

function isOnCooldown(G, eventDef) {
  const cd = Number(eventDef?.cooldownDays ?? 0);
  if (!Number.isFinite(cd) || cd <= 0) return false;

  const day = Number(G?.gameTime ?? 0);
  const last = Number(G?.eventCooldowns?.[eventDef.id] ?? -1e12);
  if (!Number.isFinite(day) || !Number.isFinite(last)) return false;
  return (day - last) < cd;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

class EventManager {
  /**
   * Check if a random event should trigger this turn
   * @param {Object} G - Game state
   * @returns {Object|null} Event that triggered, or null
   */
  static checkForRandomEvent(G) {

    /*
      Dont trigger new events if one is already active.
      One event at a time for now to simplify testing.
      TODO: Reclarify with team to confirm that multiple
      events can occur in one day. 
      - Ravon
    */
    if (G.activeEvent && G.activeEvent.turnsRemaining > 0) {
      return null;
    }

    // Roll for each possible event (random order to avoid bias by key ordering)
    const eventKeys = shuffleInPlace(Object.keys(EVENTS));
    for (const key of eventKeys) {
      const event = EVENTS[key];
      if (!event || !event.id) continue;
      if (!meetsPreconditions(G, event)) continue;
      if (isOnCooldown(G, event)) continue;

      const prob = clampNumber(event.probability ?? 0, 0, 1);
      if (Math.random() < prob) {
        return this.triggerEvent(G, event.id);
      }
    }

    return null;
  }

  /**
   * Manually trigger a specific event
   * @param {Object} G - Game state
   * @param {string} eventId - ID of event to trigger
   * @returns {Object} Triggered event with turn info
   */
  static triggerEvent(G, eventId) {
    const event = EVENTS[eventId];
    if (!event) {
      throw new Error(`Unknown event: ${eventId}`);
    }

    // Only store serializable event data in G.activeEvent
    G.activeEvent = {
      id: String(event.id),
      type: String(event.type),
      name: String(event.name),
      description: String(event.description),
      cause: String(event.cause || ''),
      effects: JSON.parse(JSON.stringify(event.effects || {})), // Deep clone
      correctiveActions: JSON.parse(JSON.stringify(event.correctiveActions || [])),
      duration: Number(event.duration),
      severity: String(event.severity),
      turnsRemaining: Number(event.duration),
      triggeredAt: Number(G.gameTime)
    };
    
    // Add repairCost if it exists
    if (event.repairCost !== undefined) {
      G.activeEvent.repairCost = Number(event.repairCost);
    }

    // Initialize event history if needed
    if (!G.eventHistory) {
      G.eventHistory = [];
    }

    if (!G.eventCooldowns) {
      G.eventCooldowns = {};
    }
    // Mark cooldown start at trigger time (even if the event lasts many days).
    G.eventCooldowns[String(event.id)] = Number(G.gameTime);

    G.eventHistory.push({
      eventId: String(event.id),
      triggeredAt: Number(G.gameTime),
      duration: Number(event.duration)
    });

    return G.activeEvent;
  }

  /**
   * Apply active event effects to game state
   * Called each turn to enforce event consequences
   * @param {Object} G - Game state
   */
  static applyEventEffects(G) {
    if (!G.activeEvent || G.activeEvent.turnsRemaining <= 0) {
      // Clear effects if no active event
      if (G.eventEffects) {
        G.eventEffects = {};
      }
      return;
    }

    const event = G.activeEvent;
    const effects = event.effects;

    const { tank, water } = ensureTankAndWater(G);

    // Initialize effects object
    if (!G.eventEffects) {
      G.eventEffects = {};
    }

    // Apply technical effects
    if (event.type === EVENT_TYPES.TECHNICAL) {
      if (effects.lightsDisabled !== undefined) {
        G.eventEffects.lightsDisabled = effects.lightsDisabled;
      }
      
      // Apply water leak effect
      if (effects.waterLossPerTurn !== undefined) {
        const loss = clampNumber(effects.waterLossPerTurn, 0, 1e12);
        tank.currentWaterLevel = clampNumber(Number(tank.currentWaterLevel ?? 0) - loss, 0, tank.capacity);
        tank.currentVolume = tank.currentWaterLevel;
        G.eventEffects.waterLossPerTurn = loss;
      }
      
      // Apply pump failure effect
      if (effects.circulationStopped !== undefined) {
        G.eventEffects.circulationStopped = effects.circulationStopped;
      }
      
      // Apply filter clog effect
      if (effects.biofilterEfficiencyReduction !== undefined) {
        // Store the pre-event efficiency once so repeated calls don't compound the reduction
        if (G.activeEvent._baseBiofilterEfficiency === undefined) {
          G.activeEvent._baseBiofilterEfficiency = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
        }
        const base = G.activeEvent._baseBiofilterEfficiency;
        const reduction = clampNumber(effects.biofilterEfficiencyReduction, 0, 1);
        tank.biofilterEfficiency = clampNumber(base * (1 - reduction), 0, 1);
        G.eventEffects.biofilterEfficiencyReduction = effects.biofilterEfficiencyReduction;
      }

      // Optional: apply per-turn water chemistry deltas for technical events.
      // Example in event.effects:
      //   waterChemistryDeltaPerTurn: { ammonia: +0.2, dissolvedOxygen: -0.5 }
      if (effects.waterChemistryDeltaPerTurn && typeof effects.waterChemistryDeltaPerTurn === 'object') {
        const d = effects.waterChemistryDeltaPerTurn;
        if (Number.isFinite(Number(d.ammonia))) water.ammonia = clampNumber(Number(water.ammonia) + Number(d.ammonia), 0, 1000);
        if (Number.isFinite(Number(d.nitrite))) water.nitrite = clampNumber(Number(water.nitrite) + Number(d.nitrite), 0, 1000);
        if (Number.isFinite(Number(d.nitrate))) water.nitrate = clampNumber(Number(water.nitrate) + Number(d.nitrate), 0, 10000);
        if (Number.isFinite(Number(d.pH))) water.pH = clampNumber(Number(water.pH) + Number(d.pH), 0, 14);
        if (Number.isFinite(Number(d.temperature))) water.temperature = clampNumber(Number(water.temperature) + Number(d.temperature), -10, 60);
        if (Number.isFinite(Number(d.dissolvedOxygen))) water.dissolvedOxygen = clampNumber(Number(water.dissolvedOxygen) + Number(d.dissolvedOxygen), 0, 20);
        if (Number.isFinite(Number(d.phosphorus))) water.phosphorus = clampNumber(Number(water.phosphorus) + Number(d.phosphorus), 0, 10000);
        if (Number.isFinite(Number(d.potassium))) water.potassium = clampNumber(Number(water.potassium) + Number(d.potassium), 0, 10000);
        if (Number.isFinite(Number(d.calcium))) water.calcium = clampNumber(Number(water.calcium) + Number(d.calcium), 0, 10000);
        if (Number.isFinite(Number(d.magnesium))) water.magnesium = clampNumber(Number(water.magnesium) + Number(d.magnesium), 0, 10000);
        if (Number.isFinite(Number(d.iron))) water.iron = clampNumber(Number(water.iron) + Number(d.iron), 0, 10000);

        G.eventEffects.waterChemistryDeltaPerTurn = JSON.parse(JSON.stringify(d));
      }
    }

    // Apply social/economic effects
    if (event.type === EVENT_TYPES.SOCIAL) {
      if (effects.transportCost !== undefined) {
        G.eventEffects.transportCost = effects.transportCost;
      }
    }
  }

  /**
   * Progress active event by one turn
   * @param {Object} G - Game state
   */
  static progressEvent(G) {
    if (!G.activeEvent) {
      return;
    }

    G.activeEvent.turnsRemaining -= 1;

    // Event expired - clean up
    if (G.activeEvent.turnsRemaining <= 0) {
      // Restore biofilter efficiency if it was reduced by this event
      if (G.activeEvent._baseBiofilterEfficiency !== undefined && G.aquaponicsSystem?.tank) {
        G.aquaponicsSystem.tank.biofilterEfficiency = clampNumber(G.activeEvent._baseBiofilterEfficiency, 0, 1);
      }
      G.activeEvent = null;
      G.eventEffects = {};
    }
  }

  /**
   * Get current event status for display
   * @param {Object} G - Game state
   * @returns {Object|null} Current event info or null
   */
  static getCurrentEvent(G) {
    if (!G.activeEvent || G.activeEvent.turnsRemaining <= 0) {
      return null;
    }

    return {
      name: G.activeEvent.name,
      description: G.activeEvent.description,
      cause: G.activeEvent.cause,
      turnsRemaining: G.activeEvent.turnsRemaining,
      type: G.activeEvent.type,
      severity: G.activeEvent.severity
    };
  }
}

module.exports = { EventManager };
