// Event Manager - handles triggering and managing game events
const { EVENTS, EVENT_TYPES } = require('../data/events');

class EventManager {
  /**
   * Check if a random event should trigger this turn
   * @param {Object} G - Game state
   * @returns {Object|null} Event that triggered, or null
   */
  static checkForRandomEvent(G) {
    // One event at a time: skip if one is active or already announced as pending.
    if ((G.activeEvent && G.activeEvent.turnsRemaining > 0) || G.pendingEvent) {
      return null;
    }

    // Grace period: no events for the first 7 days so players can establish their system.
    if (Number(G.gameTime) < 7) {
      return null;
    }

    // Roll for each possible event. Shuffle first so no event is systematically
    // preempted by earlier entries.
    const eventKeys = Object.keys(EVENTS).sort(() => Math.random() - 0.5);
    for (const key of eventKeys) {
      const event = EVENTS[key];
      if (Math.random() < event.probability) {
        // Return the raw event definition — the caller decides whether to store
        // it as pending (TECHNICAL) or trigger it immediately (SOCIAL).
        return event;
      }
    }

    return null;
  }

  /**
   * Promote a pending technical event to active so effects start applying.
   * Called at the top of each turn after the player has had a chance to react.
   */
  static promoteToActive(G) {
    if (!G.pendingEvent) return;
    const eventId = G.pendingEvent.id;
    G.pendingEvent = null; // clear before triggerEvent to avoid guard conflicts
    EventManager.triggerEvent(G, eventId);
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
      duration: Number(event.duration),
      severity: String(event.severity),
      turnsRemaining: Number(event.duration),
      triggeredAt: Number(G.gameTime)
    };

    // Snapshot pre-event system state so applyEventEffects can apply a fixed
    // reduction each turn rather than compounding on the already-reduced value.
    const eff = event.effects || {};
    if (eff.biofilterEfficiencyReduction !== undefined) {
      G.activeEvent.preEventBiofilterEfficiency =
        Number(G.aquaponicsSystem?.tank?.biofilterEfficiency ?? 0.8);
    }
    if (eff.circulationEfficiencyReduction !== undefined) {
      G.activeEvent.preEventCirculationEfficiency =
        Number(G.aquaponicsSystem?.tank?.circulationEfficiency ?? 1.0);
    }

    // Add repairCost if it exists
    if (event.repairCost !== undefined) {
      G.activeEvent.repairCost = Number(event.repairCost);
    }

    // Initialize event history if needed
    if (!G.eventHistory) {
      G.eventHistory = [];
    }

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
      if (effects.waterLossPerTurn !== undefined && G.aquaponicsSystem && G.aquaponicsSystem.tank) {
        const tank = G.aquaponicsSystem.tank;
        tank.currentWaterLevel = Math.max(0, tank.currentWaterLevel - effects.waterLossPerTurn);
        G.eventEffects.waterLossPerTurn = effects.waterLossPerTurn;
      }
      
      // Apply pump failure effect
      if (effects.circulationStopped !== undefined) {
        G.eventEffects.circulationStopped = effects.circulationStopped;
      }
      
      // Apply filter clog effect — always derive from the pre-event snapshot so the
      // reduction doesn't compound every turn (0.8 → 0.4 → 0.2 → 0.1 → …).
      if (effects.biofilterEfficiencyReduction !== undefined && G.aquaponicsSystem && G.aquaponicsSystem.tank) {
        const tank = G.aquaponicsSystem.tank;
        const baseline = Number.isFinite(G.activeEvent.preEventBiofilterEfficiency)
          ? G.activeEvent.preEventBiofilterEfficiency
          : (tank.biofilterEfficiency || 0.8);
        tank.biofilterEfficiency = Math.max(0, baseline * (1 - effects.biofilterEfficiencyReduction));
        G.eventEffects.biofilterEfficiencyReduction = effects.biofilterEfficiencyReduction;
      }

      // Apply water quality changes from aquaponics failure modes
      if (G.aquaponicsSystem && G.aquaponicsSystem.tank && G.aquaponicsSystem.tank.water) {
        const water = G.aquaponicsSystem.tank.water;

        if (effects.ammoniaIncrease !== undefined) {
          water.ammonia = Math.max(0, water.ammonia + Number(effects.ammoniaIncrease));
          G.eventEffects.ammoniaIncrease = Number(effects.ammoniaIncrease);
        }

        if (effects.nitriteIncrease !== undefined) {
          water.nitrite = Math.max(0, water.nitrite + Number(effects.nitriteIncrease));
          G.eventEffects.nitriteIncrease = Number(effects.nitriteIncrease);
        }

        if (effects.nitrateIncrease !== undefined) {
          water.nitrate = Math.max(0, water.nitrate + Number(effects.nitrateIncrease));
          G.eventEffects.nitrateIncrease = Number(effects.nitrateIncrease);
        }

        if (effects.dissolvedOxygenDecrease !== undefined) {
          water.dissolvedOxygen = Math.max(0, water.dissolvedOxygen - Number(effects.dissolvedOxygenDecrease));
          G.eventEffects.dissolvedOxygenDecrease = Number(effects.dissolvedOxygenDecrease);
        }

        if (effects.pHDecrease !== undefined) {
          // Floor at 5.0 — below this, bacteria die and the system can't recover without
          // a full drain; pH 0 is physically meaningless in an aquaponics context.
          water.pH = Math.max(5.0, water.pH - Number(effects.pHDecrease));
          G.eventEffects.pHDecrease = Number(effects.pHDecrease);
        }

        if (effects.pHIncrease !== undefined) {
          water.pH = Math.min(14, water.pH + Number(effects.pHIncrease));
          G.eventEffects.pHIncrease = Number(effects.pHIncrease);
        }

        if (effects.nitrateDecrease !== undefined) {
          water.nitrate = Math.max(0, water.nitrate - Number(effects.nitrateDecrease));
          G.eventEffects.nitrateDecrease = Number(effects.nitrateDecrease);
        }

        if (effects.ironDecrease !== undefined) {
          water.iron = Math.max(0, water.iron - Number(effects.ironDecrease));
          G.eventEffects.ironDecrease = Number(effects.ironDecrease);
        }
      }

      if (effects.fishHealthReduction !== undefined && Array.isArray(G.fish)) {
        // fishHealthReductionFraction (0–1) limits what fraction of the population is
        // affected each day of the event.  Defaults to 1.0 so events without the field
        // keep their existing behaviour.
        const fishFraction = Math.max(0, Math.min(1,
          Number.isFinite(effects.fishHealthReductionFraction)
            ? effects.fishHealthReductionFraction : 1.0
        ));
        G.fish.forEach((fish) => {
          if (Math.random() < fishFraction) {
            fish.health = Math.max(0, Number(fish.health ?? 0) - Number(effects.fishHealthReduction));
          }
        });
        G.eventEffects.fishHealthReduction = Number(effects.fishHealthReduction);
      }

      if (effects.plantHealthReduction !== undefined && Array.isArray(G.plants)) {
        const plantFraction = Math.max(0, Math.min(1,
          Number.isFinite(effects.plantHealthReductionFraction)
            ? effects.plantHealthReductionFraction : 1.0
        ));
        G.plants.forEach((plant) => {
          if (Math.random() < plantFraction) {
            plant.health = Math.max(0, Number(plant.health ?? 0) - Number(effects.plantHealthReduction));
          }
        });
        G.eventEffects.plantHealthReduction = Number(effects.plantHealthReduction);
      }

      if (effects.circulationEfficiencyReduction !== undefined) {
        const tank = G.aquaponicsSystem?.tank;
        if (tank) {
          const circBaseline = Number.isFinite(G.activeEvent.preEventCirculationEfficiency)
            ? G.activeEvent.preEventCirculationEfficiency
            : (tank.circulationEfficiency ?? 1.0);
          tank.circulationEfficiency = Math.max(0.1, circBaseline - Number(effects.circulationEfficiencyReduction));
          G.eventEffects.circulationEfficiencyReduction = Number(effects.circulationEfficiencyReduction);
        }
      }
    }

    // Apply social/economic effects
    if (event.type === EVENT_TYPES.SOCIAL) {
      if (Number.isFinite(effects.moneyBonus)) {
        G.money = parseFloat(((Number(G.money) || 0) + Number(effects.moneyBonus)).toFixed(2));
        G.eventEffects.moneyBonus = Number(effects.moneyBonus);
      }
      if (Number.isFinite(effects.transportCost)) {
        G.money = parseFloat((Math.max(0, (Number(G.money) || 0) - Number(effects.transportCost))).toFixed(2));
        G.eventEffects.transportCost = Number(effects.transportCost);
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
      const eff = G.activeEvent.effects || {};
      const tank = G.aquaponicsSystem?.tank;

      if (tank) {
        // Restore circulationEfficiency for events that reduced it temporarily
        // (e.g. lowDissolvedOxygen, duration 1, no repairCost).
        // filterClog reduces biofilterEfficiency but has duration 999 + repairCost —
        // it should never expire naturally, so we leave biofilterEfficiency to repairSystem.
        if (
          eff.circulationEfficiencyReduction !== undefined &&
          Number.isFinite(G.activeEvent.preEventCirculationEfficiency)
        ) {
          tank.circulationEfficiency = G.activeEvent.preEventCirculationEfficiency;
        }
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
