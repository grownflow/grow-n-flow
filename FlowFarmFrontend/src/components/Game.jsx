// src/components/Game.jsx
import React, { useState, useEffect, useRef } from 'react';

// Groups deaths by reason, counts by species type within each reason.
// Example output: "3× tilapia (ammonia poisoning), 1× catfish (old age)"
function summarizeDeaths(deaths, defaultType) {
  const counts = {};
  for (const d of deaths) {
    const type = d?.type || defaultType;
    const reason = d?.reason || 'health decline';
    const key = `${type}||${reason}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, n]) => {
      const [type, reason] = key.split('||');
      return n > 1 ? `${n}× ${type} (${reason})` : `${type} (${reason})`;
    })
    .join(', ');
}
import gameAPI from '../services/gameAPI';
import soundManager from '../services/soundManager';
import { PLANT_SLOT_COUNT } from '../config/plantSlots';
import Renderer from './Renderer';
import StatsSection from './StatsSection';
import BillsPanel from './BillsPanel';
import EventsPanel from './EventsPanel';
import FishTankSection from './FishTankSection';
import InventoryPanel from './InventoryPanel';
import MarketPanel from './MarketPanel';
import PlantsSection from './PlantsSection';
import WaterSection from './WaterSection';
import "./Game.css"

function Game({ onTitleClick }) {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  const [lastTurnAlerted, setLastTurnAlerted] = useState(null);
  const [turnNotification, setTurnNotification] = useState(null); // { messages: string[], turn: number }

  const [activeViewpoint, setActiveViewpoint] = useState('Viewpoint1');
  const [lastPickedLabel, setLastPickedLabel] = useState('—');
  const [selection, setSelection] = useState(null); // { kind: 'plant' | 'fish', id }

  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('market');
  const [matchId, setMatchId] = useState(null);

  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [storedMatches, setStoredMatches] = useState([]);
  const [storedMatchesLoading, setStoredMatchesLoading] = useState(false);
  const [storedMatchesError, setStoredMatchesError] = useState(null);
  const loadMenuRef = useRef(null);

  const [feedFishStatus, setFeedFishStatus] = useState({ pending: false, message: null, ok: null, at: null });
  const [muted, setMutedState] = useState(() => soundManager.isMuted());

  const toggleMute = () => {
    const next = !muted;
    soundManager.setMuted(next);
    setMutedState(next);
  };

  // Initialize game on component mount
  useEffect(() => {
    resumeGame();
    
    // Cleanup on unmount
    return () => {
      gameAPI.disconnect();
    };
  }, []);

  const resumeGame = async () => {
    setLoading(true);
    setError(null);
    try {
      const matchID = await gameAPI.createMatch((state) => {
        if (state) {
          setGameState(state);
          setConnected(true);
          setLoading(false);
        }
      }, { mode: 'resume' });

      setMatchId(matchID || null);
    } catch (err) {
      setError('Failed to resume game: ' + err.message);
      setLoading(false);
    }
  };

  const fetchStoredMatches = async () => {
    setStoredMatchesLoading(true);
    setStoredMatchesError(null);
    try {
      const res = await fetch('http://localhost:4000/api/games/aquaponics/matches?limit=200', {
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Fetch matches failed: ${res.status}`);
      setStoredMatches(Array.isArray(body?.items) ? body.items : []);
    } catch (e) {
      setStoredMatchesError(e?.message || String(e));
      setStoredMatches([]);
    } finally {
      setStoredMatchesLoading(false);
    }
  };

  const openLoadMenu = async () => {
    setLoadMenuOpen(true);
    await fetchStoredMatches();
  };

  const closeLoadMenu = () => {
    setLoadMenuOpen(false);
  };

  useEffect(() => {
    if (!loadMenuOpen) return;

    const onDocMouseDown = (e) => {
      const node = loadMenuRef.current;
      if (!node) return;
      if (node.contains(e.target)) return;
      closeLoadMenu();
    };

    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [loadMenuOpen]);

  const handleLoadMatch = async (id) => {
    if (!id) return;
    // Clear all stale state from the previous game before loading the new one.
    setLoading(true);
    setError(null);
    setGameState(null);
    setConnected(false);
    setLastTurnAlerted(null);
    setTurnNotification(null);
    setSelection(null);
    setFeedFishStatus({ pending: false, message: null, ok: null, at: null });
    try {
      const loaded = await gameAPI.loadMatch(String(id), (state) => {
        if (state) {
          setGameState(state);
          setConnected(true);
          setLoading(false);
        }
      });
      setMatchId(loaded || null);
      closeLoadMenu();
    } catch (err) {
      setError('Failed to load game: ' + err.message);
      setLoading(false);
    }
  };

  const formatWhen = (isoOrDate) => {
    if (!isoOrDate) return '—';
    try {
      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return '—';
      return d.toLocaleString();
    } catch {
      return '—';
    }
  };

  const startNewGame = async () => {
    closeLoadMenu();
    setLoading(true);
    setError(null);
    setGameState(null);
    setConnected(false);
    setLastTurnAlerted(null);
    setTurnNotification(null);
    setSelection(null);
    setFeedFishStatus({ pending: false, message: null, ok: null, at: null });
    try {
      const createdMatchId = await gameAPI.createMatch((state) => {
        if (state) {
          setGameState(state);
          setConnected(true);
          setLoading(false);
        }
      }, { mode: 'create' });

      setMatchId(createdMatchId || null);
    } catch (err) {
      setError('Failed to start new game: ' + err.message);
      setLoading(false);
    }
  };

  const handleAddFish = (fishType, count) => {
    gameAPI.addFish(fishType, count); // count maps to quantity param
  };

  const handleSellFish = (fishId) => {
    console.log(`[Game] handleSellFish clicked: ${fishId}`);
    soundManager.play('harvest');
    gameAPI.sellFish(fishId);
  };

  const handlePlantSeed = (plantType) => {
    const bedLocation = `bed_${Date.now()}`;
    console.log('[Game] handlePlantSeed called:', plantType, bedLocation);
    gameAPI.plantSeed(plantType, bedLocation, PLANT_SLOT_COUNT);
  };

  const handleBuyAllSeeds = async (plantType, seedCost) => {
    if (!gameState?.G) return;

    const maxPlantSlots = Math.max(gameState.G.maxPlantSlots || 0, PLANT_SLOT_COUNT);
    const openSlots = Math.max(0, maxPlantSlots - (gameState.G.plants?.length || 0));
    const costPerSeed = Number(seedCost) > 0 ? Number(seedCost) : 0.3;
    const affordableCount = Math.floor((gameState.G.money || 0) / costPerSeed);
    const buyCount = Math.min(openSlots, affordableCount);

    if (buyCount <= 0) return;

    const result = await gameAPI.plantSeedsBulk(plantType, buyCount, PLANT_SLOT_COUNT);
    if (result?.error) {
      console.warn('[Game] buy-all failed:', result.error);
    }
  };

  const handleFeedFish = async (overrideAmount) => {
    if (feedFishStatus.pending) return;

    const fishIdentifier = 'tank';

    const availableFood = Math.floor(Number(gameState?.G?.fishFood) || 0);
    const fallbackDesired = 10;
    const desired = Math.floor(Number(overrideAmount) || fallbackDesired);
    const amount = Math.max(1, desired);

    setFeedFishStatus({ pending: true, message: 'Adding food…', ok: null, at: Date.now() });
    try {
      const res = await gameAPI.feedFish(fishIdentifier, amount);
      const action = res?.G?.lastAction;

      // Prefer the move's lastAction. G.error may be stale from earlier moves.
      if (action?.type === 'feedFish') {
        if (action?.success === false) {
          const reason = action?.reason ? ` (${action.reason})` : '';
          setFeedFishStatus({ pending: false, message: `Add food failed${reason}.`, ok: false, at: Date.now() });
          return;
        }

        const used = action?.foodAmountUsed ?? action?.foodAmountRequested;
        const invRemaining = action?.inventoryFoodRemaining;
        const tankBefore = action?.tankFoodBefore;
        const tankAfter = action?.tankFoodAfter;
        const partial = Boolean(action?.partial);
        const msg = `Added ${used ?? '—'} food into tank${partial ? ' (partial)' : ''}. `
          + `Tank food: ${tankBefore ?? '—'} → ${tankAfter ?? '—'}. `
          + `Inventory fish food remaining: ${invRemaining ?? availableFood ?? '—'}.`;
        soundManager.play('feedFish');
        setFeedFishStatus({ pending: false, message: msg, ok: true, at: Date.now() });
        return;
      }

      if (res?.error || res?.G?.error) {
        setFeedFishStatus({ pending: false, message: String(res?.error || res?.G?.error), ok: false, at: Date.now() });
        return;
      }

      setFeedFishStatus({ pending: false, message: 'Food added.', ok: true, at: Date.now() });
    } catch (e) {
      setFeedFishStatus({ pending: false, message: e?.message || String(e), ok: false, at: Date.now() });
    }
  };

  const handleProgressTurn = () => {
    console.log('[Game] handleProgressTurn clicked');
    soundManager.play('progressDay');
    gameAPI.progressTurn();
  };

  const handleProgress3Days = async () => {
    console.log('[Game] handleProgress3Days clicked');
    soundManager.play('progress3Days');
    setLoading(true);
    try {
      await gameAPI.progressMultipleTurns(3);
    } finally {
      setLoading(false);
    }
  };

  const handleHarvestPlant = (plantId) => {
    console.log('[Game] handleHarvestPlant called:', plantId);
    soundManager.play('harvest');
    gameAPI.harvestPlant(plantId);
  };

  const handleHarvestAllMaturePlants = () => {
    console.log('[Game] handleHarvestAllMaturePlants clicked');
    soundManager.play('harvest');
    gameAPI.harvestAllMaturePlants();
  };

  const handleRepairSystem = () => {
    gameAPI.repairSystem();
  };

  const tabs = [
    { id: 'market', label: 'Market' },
    { id: 'water', label: 'Water' },
    { id: 'plants', label: 'Plants' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'fish', label: 'Fish' },
    { id: 'bills', label: 'Bills' },
    { id: 'events', label: 'Events' },
  ];

  useEffect(() => {
    // Bind the selected viewpoint in X3DOM (mirrors UI_1e.html behavior).
    if (!activeViewpoint) return;

    let cancelled = false;
    let attempts = 0;

    const tryBind = () => {
      if (cancelled) return;

      const vp = document.getElementById(activeViewpoint);
      if (vp) {
        try {
          // Preferred X3DOM eventIn name
          vp.setAttribute('set_bind', 'true');
        } catch {
          // ignore
        }

        try {
          // UI_1e.html uses the property; keep it as a fallback.
          vp.bind = true;
        } catch {
          // ignore
        }
        return;
      }

      if (attempts < 30) {
        attempts += 1;
        requestAnimationFrame(tryBind);
      }
    };

    tryBind();
    return () => {
      cancelled = true;
    };
  }, [activeViewpoint]);

  useEffect(() => {
    const turn = gameState?.ctx?.turn;
    const action = gameState?.G?.lastAction;
    if (!turn || !action || action.type !== 'progressTurn') return;
    if (turn === lastTurnAlerted) return;

    const messages = [];

    const fishDeaths = Array.isArray(action?.fishDeaths) ? action.fishDeaths : [];
    if (fishDeaths.length > 0) {
      messages.push(`Fish died: ${summarizeDeaths(fishDeaths, 'fish')}`);
    }

    const plantDeaths = Array.isArray(action?.plantDeaths) ? action.plantDeaths : [];
    if (plantDeaths.length > 0) {
      messages.push(`Plants lost: ${summarizeDeaths(plantDeaths, 'plant')}`);
    }

    if (action?.eventTriggered) {
      if (action?.eventPending) {
        const name = action?.eventName || 'an event';
        const desc = action?.eventDescription ? ` — ${action.eventDescription}` : '';
        messages.push(`Upcoming: ${name}${desc} Take action now before your next turn!`);
      } else {
        const name = action?.eventName || 'an event';
        messages.push(`Event: ${name}`);
      }
      soundManager.play('eventAlert');
    }

    if (messages.length > 0) {
      setTurnNotification({ messages, turn });
      setLastTurnAlerted(turn);
    }
  }, [gameState?.ctx?.turn, gameState?.G?.lastAction, lastTurnAlerted]);

  const handlePicked = ({ label }) => {
    if (!label) return;

    const picked = String(label);

    // Clicking empty space often resolves to the X3DOM canvas.
    if (picked.includes('x3dom-') && picked.endsWith('-canvas')) {
      return;
    }

    setLastPickedLabel(picked);

    // Minimal linkage: route picks to the existing tabs.
    if (picked.startsWith('Plant_')) {
      const plantId = picked.slice('Plant_'.length);
      setSelection(plantId ? { kind: 'plant', id: plantId } : null);
      return;
    }

    if (picked.startsWith('Fish_')) {
      const fishId = picked.slice('Fish_'.length);
      setSelection(fishId ? { kind: 'fish', id: fishId } : null);
      return;
    }

    if (picked.startsWith('FishTransform_')) {
      // Older/alternate label form; keep fallback behavior.
      const fishId = picked.slice('FishTransform_'.length);
      setSelection(fishId ? { kind: 'fish', id: fishId } : null);
      return;
    }
  };

  const selectedPlant = (selection?.kind === 'plant' && selection?.id)
    ? (gameState?.G?.plants || []).find((p) => p.id === selection.id)
    : null;

  const selectedFish = (selection?.kind === 'fish' && selection?.id)
    ? (gameState?.G?.fish || []).find((f) => f.id === selection.id)
    : null;

  const formatPlantName = (type) => {
    if (!type) return '—';
    return String(type).replace(/([A-Z])/g, ' $1').trim();
  };

  useEffect(() => {
    // Bridge for X3DOM inline onclick="..." handlers (UI_1e.html style).
    // This is more reliable than trying to infer picked nodes from canvas events.
    window.__gnfPick = (label) => {
      handlePicked({ label });
    };

    return () => {
      try {
        delete window.__gnfPick;
      } catch {
        window.__gnfPick = undefined;
      }
    };
  }, [handlePicked]);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    if (!panelOpen) setPanelOpen(true);
  };

  const activeEvent = gameState?.G?.activeEvent;
  const pendingEvent = gameState?.G?.pendingEvent;
  const dayNumber = gameState?.G?.gameTime ?? gameState?.ctx?.turn ?? null;
  const money = gameState?.G?.money ?? null;

  return (
    <div className="scene-shell">
      <header className="topbar" aria-label="Game header">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-title topbar-title-button"
            onClick={() => onTitleClick && onTitleClick()}
            aria-label="Open account"
          >
            Grow-n-Flow
          </button>
          <div className="topbar-stats">
            <span>Day: {dayNumber ?? '—'}</span>
            <span>Money: {money != null ? `$${Number(money).toFixed(2)}` : '—'}</span>
            <span className={`event-status ${activeEvent ? 'danger' : pendingEvent ? 'warning' : 'good'}`}>
              {activeEvent
                ? `Event: ${activeEvent.name} (${activeEvent.turnsRemaining}d left)`
                : pendingEvent
                  ? `Upcoming: ${pendingEvent.name}`
                  : 'No active events'}
            </span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="load-menu" ref={loadMenuRef}>
            <button
              onClick={() => (loadMenuOpen ? closeLoadMenu() : openLoadMenu())}
              disabled={loading}
              className="btn-newgame"
              type="button"
              aria-haspopup="menu"
              aria-expanded={loadMenuOpen}
            >
              Load Game
            </button>

            {loadMenuOpen && (
              <div className="load-menu-panel" role="menu" aria-label="Load game menu">
                <div className="load-menu-header">
                  <div className="load-menu-title">Your Games</div>
                  <button className="load-menu-close" type="button" onClick={closeLoadMenu} aria-label="Close">
                    ×
                  </button>
                </div>

                {storedMatchesLoading && (
                  <div className="load-menu-row">Loading…</div>
                )}

                {storedMatchesError && (
                  <div className="load-menu-row load-menu-error">
                    {storedMatchesError}
                    <button type="button" className="load-menu-retry" onClick={fetchStoredMatches}>Retry</button>
                  </div>
                )}

                {!storedMatchesLoading && !storedMatchesError && storedMatches.length === 0 && (
                  <div className="load-menu-row">No saved games yet.</div>
                )}

                {!storedMatchesLoading && !storedMatchesError && storedMatches.length > 0 && (
                  <div className="load-menu-list">
                    {storedMatches.map((m) => (
                      <button
                        key={m.matchID}
                        type="button"
                        className={`load-menu-item ${String(m.matchID) === String(matchId) ? 'active' : ''}`}
                        onClick={() => handleLoadMatch(m.matchID)}
                      >
                        <div className="load-menu-item-top">
                          <span className="load-menu-item-id">{m.matchID}</span>
                          <span className="load-menu-item-status">{m.status || '—'}</span>
                        </div>
                        <div className="load-menu-item-sub">
                          <span>Day: {m.gameTime ?? '—'}</span>
                          <span>Updated: {formatWhen(m.updatedAt)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="load-menu-footer">
                  <button type="button" className="load-menu-action" onClick={startNewGame} disabled={loading || storedMatchesLoading}>
                    New Game
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleProgressTurn} disabled={loading || !connected} className="btn-progress" type="button">Progress Day</button>
          <button onClick={handleProgress3Days} disabled={loading || !connected} className="btn-progress" type="button">Progress 3 Days</button>
          <button
            type="button"
            className={`btn-mute ${muted ? 'muted' : ''}`}
            onClick={toggleMute}
            aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </header>

      {turnNotification && (
        <div className="turn-notification" role="alert" aria-live="polite">
          <div className="turn-notification-body">
            {turnNotification.messages.map((msg, i) => (
              <div key={i} className="turn-notification-line">{msg}</div>
            ))}
          </div>
          <button
            type="button"
            className="turn-notification-close"
            aria-label="Dismiss notification"
            onClick={() => setTurnNotification(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="left-overlays" aria-label="Scene overlays">
        <div className="views-overlay" aria-label="Viewpoint navigation">
          <div className="views-overlay-title">Grow-n-Flow</div>
          <div className="views-overlay-subtitle">Views</div>

          <fieldset className="viewpoint-fieldset">
            <legend className="sr-only">Scene viewpoints</legend>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint1"
                checked={activeViewpoint === 'Viewpoint1'}
                onChange={() => setActiveViewpoint('Viewpoint1')}
              />
              Overview
            </label>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint2"
                checked={activeViewpoint === 'Viewpoint2'}
                onChange={() => setActiveViewpoint('Viewpoint2')}
              />
              Fish Tank
            </label>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint3"
                checked={activeViewpoint === 'Viewpoint3'}
                onChange={() => setActiveViewpoint('Viewpoint3')}
              />
              Water Filter
            </label>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint4"
                checked={activeViewpoint === 'Viewpoint4'}
                onChange={() => setActiveViewpoint('Viewpoint4')}
              />
              Bed 1
            </label>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint5"
                checked={activeViewpoint === 'Viewpoint5'}
                onChange={() => setActiveViewpoint('Viewpoint5')}
              />
              Bed 2
            </label>
            <label className="viewpoint-option">
              <input
                type="radio"
                name="viewpoints"
                value="Viewpoint6"
                checked={activeViewpoint === 'Viewpoint6'}
                onChange={() => setActiveViewpoint('Viewpoint6')}
              />
              Bed 3
            </label>
          </fieldset>
        </div>

        {selection && (
          <div className="selection-overlay" aria-label="Selected item">
            <div className="selection-overlay-header">
              <div className="selection-overlay-title">
                {selection.kind === 'fish' ? 'Selected Fish' : 'Selected Plant'}
              </div>
              <button
                className="selection-overlay-close"
                type="button"
                aria-label="Clear selection"
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </div>

            {selection.kind === 'plant' && (
              selectedPlant ? (
                <div className="selection-overlay-body">
                  <div className="selection-row"><strong>Type:</strong> {formatPlantName(selectedPlant.type)}</div>
                  <div className="selection-row"><strong>Stage:</strong> {selectedPlant.growthStage ?? '—'}</div>
                  <div className="selection-row"><strong>Health:</strong> {selectedPlant.health ?? '—'}/10</div>
                  <div className="selection-row"><strong>Age:</strong> {selectedPlant.age ?? '—'}d / {selectedPlant.growthDays ?? '—'}d</div>
                  <div className="selection-row"><strong>Slot:</strong> {selectedPlant.slotIndex ?? '—'}</div>
                  <div className="selection-row"><strong>Location:</strong> {selectedPlant.location ?? '—'}</div>
                  <div className="selection-row"><strong>Value:</strong> {selectedPlant.valuePerHead != null ? `$${Number(selectedPlant.valuePerHead).toFixed(2)}` : '—'}</div>
                </div>
              ) : (
                <div className="selection-overlay-body">
                  <div className="selection-row">Plant not found (maybe harvested).</div>
                </div>
              )
            )}

            {selection.kind === 'fish' && (
              selectedFish ? (
                <div className="selection-overlay-body">
                  <div className="selection-row"><strong>Type:</strong> {selectedFish.type ?? '—'}</div>
                  <div className="selection-row"><strong>Health:</strong> {selectedFish.health ?? '—'}/10</div>
                  <div className="selection-row"><strong>Age:</strong> {selectedFish.age ?? '—'}d</div>
                  <div className="selection-row"><strong>Weight:</strong> {selectedFish.weight != null ? `${Math.round(Number(selectedFish.weight))}g` : '—'}</div>
                  <div className="selection-row"><strong>Market Value:</strong> {selectedFish.marketValue != null ? `$${Number(selectedFish.marketValue).toFixed(2)}/lb` : '—'}</div>
                  <div className="selection-row"><strong>Food Rate:</strong> {selectedFish.foodConsumptionRate ?? '—'}</div>
                  <div className="selection-row"><strong>Ammonia Rate:</strong> {selectedFish.ammoniaProductionRate ?? '—'}</div>
                </div>
              ) : (
                <div className="selection-overlay-body">
                  <div className="selection-row">Fish not found (maybe sold/removed).</div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      <div className="scene-layer">
        <Renderer gameState={gameState} onPicked={handlePicked} />
      </div>

      {!panelOpen && (
        <button className="panel-toggle" onClick={() => setPanelOpen(true)} aria-label="Open side panel">
          Panel
        </button>
      )}

      <aside className={`ui-panel ${panelOpen ? 'open' : 'closed'}`} aria-label="Side panel">
        <div className="ui-panel-header">
          <div className="ui-tabs" role="tablist" aria-label="UI tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`ui-tab ${activeTab === t.id ? 'active' : ''}`}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => switchTab(t.id)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
          <button className="ui-close" onClick={() => setPanelOpen(false)} aria-label="Close side panel" type="button">
            ×
          </button>
        </div>

        <div className="ui-panel-body">
          {error && (
            <div className="error-message">
              <span>{error}</span>
              <button onClick={startNewGame} type="button">Retry</button>
            </div>
          )}

          {!gameState && (
            <section>
              <h2>Loading</h2>
              <p className="empty-message">Waiting for game state…</p>
            </section>
          )}

          {activeTab === 'market' && gameState && (
            <MarketPanel gameState={gameState} loading={loading} matchId={matchId} />
          )}

          {activeTab === 'water' && gameState && (
            <WaterSection gameState={gameState} loading={loading} />
          )}

          {activeTab === 'plants' && gameState && (
            <PlantsSection
              gameState={gameState}
              loading={loading}
              handleHarvestPlant={handleHarvestPlant}
              handleHarvestAllMaturePlants={handleHarvestAllMaturePlants}
              handlePlantSeed={handlePlantSeed}
              handleBuyAllSeeds={handleBuyAllSeeds}
            />
          )}

          {activeTab === 'inventory' && gameState && (
            <InventoryPanel gameState={gameState} loading={loading} />
          )}

          {activeTab === 'fish' && gameState && (
            <FishTankSection
              gameState={gameState}
              loading={loading}
              handleAddFish={handleAddFish}
              handleSellFish={handleSellFish}
              handleFeedFish={handleFeedFish}
              feedFishStatus={feedFishStatus}
            />
          )}

          {activeTab === 'bills' && gameState && (
            <BillsPanel gameState={gameState} />
          )}

          {activeTab === 'events' && gameState && (
            <EventsPanel gameState={gameState} onRepair={handleRepairSystem} />
          )}
        </div>
      </aside>
    </div>
  );
}

export default Game;