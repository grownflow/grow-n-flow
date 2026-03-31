// REST-based game API client using backend HTTP routes and polling.
const API_BASE = 'http://localhost:4000/api/games/aquaponics';

class GameAPI {
  constructor() {
    this.matchID = null;
    this.pollHandle = null;
    this.state = null;
    this.connecting = false;
  }

  async createMatch(onStateChange) {
    if (this.connecting) return;
    this.connecting = true;
    try {
      console.log('[gameAPI] Creating match via REST:', API_BASE + '/create');
      const res = await fetch(`${API_BASE}/create`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Create match failed: ' + res.status);
      const body = await res.json();
      // MatchHandler.create may return different shapes; try common fields
      this.matchID = body.matchID || body.id || body._id || body.match || body.id;
      if (!this.matchID && body && typeof body === 'object') {
        // fallback: try to find a string value
        for (const k of Object.keys(body)) {
          if (typeof body[k] === 'string' && body[k].includes('match')) { this.matchID = body[k]; break; }
        }
      }
      console.log('[gameAPI] matchID:', this.matchID);

      // Start polling for state
      this.startPolling(onStateChange);
      return this.matchID;
    } finally {
      this.connecting = false;
    }
  }

  startPolling(onStateChange, interval = 1000) {
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (!this.matchID) return;
    this.pollHandle = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/${this.matchID}`);
        if (!res.ok) return;
        const json = await res.json();
        this.state = json;
        if (onStateChange) onStateChange(json);
      } catch (e) {
        console.warn('[gameAPI] poll error', e);
      }
    }, interval);
  }

  stopPolling() {
    if (this.pollHandle) clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  getGameState() {
    return this.state?.G || null;
  }

  async makeMove(move, args = [], playerID = '0') {
    if (!this.matchID) throw new Error('No match');
    const res = await fetch(`${API_BASE}/${this.matchID}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, args, playerID }),
    });
    return res.json();
  }

  // Convenience wrappers for moves used by the UI
  addFish(fishType, quantity) { return this.makeMove('addFish', [fishType, quantity]); }
  feedFish(fishId, foodAmount) { return this.makeMove('feedFish', [fishId, foodAmount]); }
  removeFish(fishId) { return this.makeMove('removeFish', [fishId]); }
  plantSeed(plantType, bedLocation, slotCount) { return this.makeMove('plantSeed', [plantType, bedLocation, slotCount]); }
  harvestPlant(plantId) { return this.makeMove('harvestPlant', [plantId]); }
  carePlant(plantId, careType) { return this.makeMove('carePlant', [plantId, careType]); }
  buyEquipment(equipmentType, quantity = 1) { return this.makeMove('buyEquipment', [equipmentType, quantity]); }
  sellFish(fishId) { return this.makeMove('sellFish', [fishId]); }
  sellProducts(productType, quantity) { return this.makeMove('sellProducts', [productType, quantity]); }
  skipTurn() { return this.makeMove('skipTurn', []); }
  progressTurn() { return this.makeMove('progressTurn', []); }
  repairSystem() { return this.makeMove('repairSystem', []); }

  disconnect() {
    this.stopPolling();
    this.matchID = null;
    this.state = null;
  }
}

export default new GameAPI();