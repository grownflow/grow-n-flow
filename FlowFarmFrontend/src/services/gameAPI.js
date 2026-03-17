// src/services/gameAPI.js
// Connects to the boardgame.io backend using the official client

import { Client } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';

// Game definition must match backend's game name
const AquaponicsGame = {
  name: 'aquaponics',
  // Minimal setup - actual setup is on the server
  setup: () => ({}),
  moves: {
    // Fish moves
    addFish: () => {},
    feedFish: () => {},
    removeFish: () => {},
    
    // Plant moves
    plantSeed: () => {},
    harvestPlant: () => {},
    carePlant: () => {},
    
    // Economy moves
    buyEquipment: () => {},
    sellFish: () => {},
    sellProducts: () => {},
    skipTurn: () => {},
    
    // System moves
    progressTurn: () => {},
    repairSystem: () => {},
  }
};

class GameAPI {
  constructor() {
    this.client = null;
    this.unsubscribe = null;
    this.state = null;
  }

  // Create and connect to a new game
  async createMatch(onStateChange) {
    console.log('[gameAPI] Creating match, connecting to http://localhost:8000...');

    // Cleanup existing client if any
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.client) {
      try {
        this.client.stop();
      } catch (e) {
        console.warn('[gameAPI] Error stopping previous client:', e);
      }
      this.client = null;
    }

    const newMatchID = `match_${Date.now()}`;
    
    // Create the boardgame.io client connected to your backend
    this.client = Client({
      game: AquaponicsGame,
      multiplayer: SocketIO({ server: 'http://localhost:8000' }),
      playerID: '0',
      matchID: newMatchID,
      debug: false,
    });

    console.log('[gameAPI] Client created, matchID:', this.client.matchID || 'none');

    // Subscribe to state changes
    this.unsubscribe = this.client.subscribe((state) => {
      console.log('[gameAPI] State update received:', state ? 'has state' : 'null', state?.G ? 'has G' : 'no G');
      if (state) {
        this.state = state;
        if (onStateChange) onStateChange(state);
      }
    });

    // Start the client
    this.client.start();
    console.log('[gameAPI] Client started');

    return this.client;
  }

  // Get current game state
  getGameState() {
    return this.state?.G || null;
  }

  // Execute moves through the client
  // Fish moves
  addFish(fishType, quantity) {
    console.log('[gameAPI] addFish called:', fishType, quantity, 'client:', !!this.client);
    if (this.client) this.client.moves.addFish(fishType, quantity);
  }

  feedFish(fishId, foodAmount) {
    console.log('[gameAPI] feedFish called:', fishId, foodAmount, 'client:', !!this.client);
    if (this.client) this.client.moves.feedFish(fishId, foodAmount);
  }

  removeFish(fishId) {
    console.log('[gameAPI] removeFish called:', fishId, 'client:', !!this.client);
    if (this.client) this.client.moves.removeFish(fishId);
  }

  // Plant moves
  plantSeed(plantType, bedLocation) {
    console.log('[gameAPI] plantSeed called:', plantType, bedLocation, 'client:', !!this.client);
    if (this.client) this.client.moves.plantSeed(plantType, bedLocation);
  }

  harvestPlant(plantId) {
    console.log('[gameAPI] harvestPlant called:', plantId, 'client:', !!this.client);
    if (this.client) this.client.moves.harvestPlant(plantId);
  }

  carePlant(plantId, careType) {
    if (this.client) this.client.moves.carePlant(plantId, careType);
  }

  // Economy moves
  buyEquipment(equipmentType, quantity = 1) {
    if (this.client) this.client.moves.buyEquipment(equipmentType, quantity);
  }

  sellFish(fishId) {
    if (this.client) this.client.moves.sellFish(fishId);
  }

  sellProducts(productType, quantity) {
    if (this.client) this.client.moves.sellProducts(productType, quantity);
  }

  skipTurn() {
    if (this.client) this.client.moves.skipTurn();
  }

  // System moves
  progressTurn() {
    console.log('[gameAPI] progressTurn called, client:', !!this.client, 'state:', !!this.state);
    if (this.client) {
      console.log('[gameAPI] Calling client.moves.progressTurn()');
      this.client.moves.progressTurn();
    } else {
      console.error('[gameAPI] No client - cannot call progressTurn');
    }
  }

  repairSystem() {
    if (this.client) this.client.moves.repairSystem();
  }

  // Cleanup
  disconnect() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.client) this.client.stop();
  }
}

export default new GameAPI();