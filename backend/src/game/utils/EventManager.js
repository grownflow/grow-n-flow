// Event Manager - handles triggering and managing game events
const { EVENTS, EVENT_TYPES } = require('../data/events');

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

    // Roll for each possible event
    const eventKeys = Object.keys(EVENTS);
    for (const key of eventKeys) {
      const event = EVENTS[key];
      if (Math.random() < event.probability) {
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
      
      // Apply filter clog effect
      if (effects.biofilterEfficiencyReduction !== undefined && G.aquaponicsSystem && G.aquaponicsSystem.tank) {
        const originalEfficiency = G.aquaponicsSystem.tank.biofilterEfficiency || 0.8;
        G.aquaponicsSystem.tank.biofilterEfficiency = originalEfficiency * (1 - effects.biofilterEfficiencyReduction);
        G.eventEffects.biofilterEfficiencyReduction = effects.biofilterEfficiencyReduction;
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
