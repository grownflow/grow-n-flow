// REST-based game API client using backend HTTP routes and polling.
const API_BASE = 'http://localhost:4000/api/games/aquaponics';

class GameAPI {
  constructor() {
    this.matchID = null;
    this.pollHandle = null;
    this.state = null;
    this.connecting = false;
    this._onStateChange = null;
  }

  async loadMatch(matchID, onStateChange) {
    if (!matchID) throw new Error('Missing matchID');

    this.stopPolling();
    this.matchID = String(matchID);

    // Fetch state once immediately (avoids waiting for first poll tick)
    const res = await fetch(`${API_BASE}/${this.matchID}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Load match failed: ' + res.status);
    const json = await res.json();
    this.state = json;
    if (onStateChange) onStateChange(json);

    this.startPolling(onStateChange);
    return this.matchID;
  }

  async createMatch(onStateChange, { mode = 'create' } = {}) {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const endpoint = mode === 'resume' ? '/resume' : '/create';
      console.log('[gameAPI] Match via REST:', API_BASE + endpoint);
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
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

      // Dev convenience: expose matchID in browser console.
      // Allows: fetch(`http://localhost:4000/api/games/aquaponics/${window.__matchID}/water-history`)
      try {
        if (typeof window !== 'undefined') {
          window.__matchID = this.matchID;
        }
      } catch {
        // ignore
      }

      // Start polling, then immediately fetch so the UI doesn't wait a full
      // poll interval before seeing the new game state.
      this.startPolling(onStateChange);
      await this._fetchAndNotify();
      return this.matchID;
    } finally {
      this.connecting = false;
    }
  }

  startPolling(onStateChange, interval = 1000) {
    this._onStateChange = onStateChange;
    if (this.pollHandle) clearInterval(this.pollHandle);
    if (!this.matchID) return;
    this.pollHandle = setInterval(async () => {
      // Snapshot matchID at tick start so that if the game switches while this
      // fetch is in-flight, the response is silently discarded.
      const tickMatchID = this.matchID;
      if (!tickMatchID) return;
      try {
        const res = await fetch(`${API_BASE}/${tickMatchID}`, { credentials: 'include' });
        if (this.matchID !== tickMatchID) return;
        if (!res.ok) return;
        const json = await res.json();
        if (this.matchID !== tickMatchID) return;
        this.state = json;
        if (onStateChange) onStateChange(json);
      } catch (e) {
        console.warn('[gameAPI] poll error', e);
      }
    }, interval);
  }

  async _fetchAndNotify() {
    if (!this.matchID || !this._onStateChange) return;
    // Snapshot matchID so that a game switch mid-await doesn't apply stale data.
    const fetchMatchID = this.matchID;
    try {
      const res = await fetch(`${API_BASE}/${fetchMatchID}`, { credentials: 'include' });
      if (this.matchID !== fetchMatchID) return;
      if (!res.ok) return;
      const json = await res.json();
      if (this.matchID !== fetchMatchID) return;
      this.state = json;
      this._onStateChange(json);
    } catch (e) {
      console.warn('[gameAPI] force-fetch error', e);
    }
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move, args, playerID }),
    });
    const result = await res.json();
    // Immediately refresh state so the UI doesn't have to wait for the next poll tick.
    await this._fetchAndNotify();
    return result;
  }

  async getWaterHistory({ limit = 200, from } = {}) {
    if (!this.matchID) throw new Error('No match');
    const qs = new URLSearchParams();
    if (limit !== undefined) qs.set('limit', String(limit));
    if (from !== undefined && from !== null) qs.set('from', String(from));
    const res = await fetch(`${API_BASE}/${this.matchID}/water-history?${qs.toString()}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Fetch water history failed: ' + res.status);
    return res.json();
  }

  // Convenience wrappers for moves used by the UI
  addFish(fishType, quantity) { return this.makeMove('addFish', [fishType, quantity]); }
  feedFish(fishId, foodAmount) { return this.makeMove('feedFish', [fishId, foodAmount]); }
  removeFish(fishId) { return this.makeMove('removeFish', [fishId]); }
  plantSeed(plantType, bedLocation, slotCount) { return this.makeMove('plantSeed', [plantType, bedLocation, slotCount]); }
  plantSeedsBulk(plantType, quantity, slotCount) { return this.makeMove('plantSeedsBulk', [plantType, quantity, slotCount]); }
  harvestPlant(plantId) { return this.makeMove('harvestPlant', [plantId]); }
  harvestAllMaturePlants() { return this.makeMove('harvestAllMaturePlants', []); }
  carePlant(plantId, careType) { return this.makeMove('carePlant', [plantId, careType]); }
  getEquipmentCatalog() { return this.makeMove('getEquipmentCatalog', []); }
  buyEquipment(equipmentType, quantity = 1) { return this.makeMove('buyEquipment', [equipmentType, quantity]); }
  sellFish(fishId) { return this.makeMove('sellFish', [fishId]); }
  sellProducts(productType, quantity) { return this.makeMove('sellProducts', [productType, quantity]); }
  skipTurn() { return this.makeMove('skipTurn', []); }
  applyConsumable(equipmentType) { return this.makeMove('applyConsumable', [equipmentType]); }
  progressTurn() { return this.makeMove('progressTurn', []); }
  progressMultipleTurns(count = 3) { return this.makeMove('progressMultipleTurns', [count]); }
  repairSystem()      { return this.makeMove('repairSystem', []); }
  quickRepairSystem() { return this.makeMove('quickRepairSystem', []); }
  setAutoFeed(enabled) { return this.makeMove('setAutoFeed', [Boolean(enabled)]); }
  stopFeeding()        { return this.makeMove('stopFeeding', []); }

  disconnect() {
    this.stopPolling();
    this.matchID = null;
    this.state = null;
  }
}

export default new GameAPI();