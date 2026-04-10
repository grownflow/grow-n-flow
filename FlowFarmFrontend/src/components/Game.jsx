// src/components/Game.jsx
import React, { useState, useEffect } from 'react';
import gameAPI from '../services/gameAPI';
import { PLANT_SLOT_COUNT } from '../config/plantSlots';
import Renderer from './Renderer';
import StatsSection from './StatsSection';
import GillPopup from './GillPopup';
import BillsPanel from './BillsPanel';
import EventsPanel from './EventsPanel';
import FishTankSection from './FishTankSection';
import PlantsSection from './PlantsSection';
import WaterSection from './WaterSection';
import "./Game.css"

function Game() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

  const [activeViewpoint, setActiveViewpoint] = useState('Viewpoint1');
  const [lastPickedLabel, setLastPickedLabel] = useState('—');
  const [selection, setSelection] = useState(null); // { kind: 'plant' | 'fish', id }

  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('controls');

  const [gillText, setGillText] = useState("");
  const [gillActive, setGillActive] = useState(false);

  const [hasClickedOnWater, setHasClickedOnWater] = useState(false);
  const [hasClickedOnPlants, setHasClickedOnPlants] = useState(false);
  const [hasClickedOnFish, setHasClickedOnFish] = useState(false);

  // Initialize game on component mount
  useEffect(() => {
    startNewGame();
    
    // Cleanup on unmount
    return () => {
      gameAPI.disconnect();
    };
  }, []);

  const startNewGame = async () => {
    setLoading(true);
    setError(null);
    try {
      // Connect to backend and subscribe to state changes
      await gameAPI.createMatch((state) => {
        // This callback fires whenever game state changes
        if (state) {
          setGameState(state); // Store full state (has .G and .ctx)
          setConnected(true);
          setLoading(false);
        }
      });
    } catch (err) {
      setError('Failed to connect to game server: ' + err.message);
      setLoading(false);
    }
  };

  const handleAddFish = (fishType, count) => {
    gameAPI.addFish(fishType, count); // count maps to quantity param
  };

  const handleSellFish = (fishId) => { console.log(`[Game] handleSellFish clicked: ${fishId}`); 
    gameAPI.sellFish(fishId);
  };

  const handlePlantSeed = (plantType) => {
    const bedLocation = `bed_${Date.now()}`;
    console.log('[Game] handlePlantSeed called:', plantType, bedLocation);
    gameAPI.plantSeed(plantType, bedLocation, PLANT_SLOT_COUNT);
  };

  const handleBuyAllSeeds = async (plantType) => {
    if (!gameState?.G) return;

    const maxPlantSlots = Math.max(gameState.G.maxPlantSlots || 0, PLANT_SLOT_COUNT);
    const openSlots = Math.max(0, maxPlantSlots - (gameState.G.plants?.length || 0));
    const seedCost = 0.3;
    const affordableCount = Math.floor((gameState.G.money || 0) / seedCost);
    const buyCount = Math.min(openSlots, affordableCount);

    if (buyCount <= 0) return;

    for (let i = 0; i < buyCount; i++) {
      const bedLocation = `bed_${Date.now()}_${i}`;
      const result = await gameAPI.plantSeed(plantType, bedLocation, PLANT_SLOT_COUNT);
      if (result?.error) {
        console.warn('[Game] buy-all stopped due to move error:', result.error);
        break;
      }
    }
  };

  const handleFeedFish = () => {
    // Backend expects (fishId, foodAmount) not (tankId, amount)
    // Using 0 as fishId for the first fish, 10 as food amount
    gameAPI.feedFish(0, 10);
  };

  const handleProgressTurn = () => {
    console.log('[Game] handleProgressTurn clicked');
    gameAPI.progressTurn();
  };

  const handleHarvestPlant = (plantId) => {
    console.log('[Game] handleHarvestPlant called:', plantId);
    gameAPI.harvestPlant(plantId);
  };

  const handleRepairSystem = () => {
    gameAPI.repairSystem();
  };

  // Gill popup controls.
  const activateGill = (text) => {
    setGillText(text);
    setGillActive(true);
  }

  const deactivateGill = () => {
    setGillActive(false);
  }

  const handleSwitchStatsPage = (page) => {
    if (page == "water" && !hasClickedOnWater) {
      activateGill("Keeping an eye on your water quality is crucial for proper plant and fish health!");
      setHasClickedOnWater(true);
    }
    else if (page == "plants" && !hasClickedOnPlants) {
      activateGill("Plants need proper nutrients and care to thrive in your aquaponics system!");
      setHasClickedOnPlants(true);
    }
    else if (page == "fish" && !hasClickedOnFish) {
      activateGill("Healthy fish produce the nutrients your plants need. Make sure to feed them well!");
      setHasClickedOnFish(true);
    }
  }

  const tabs = [
    { id: 'controls', label: 'Controls' },
    { id: 'water', label: 'Water' },
    { id: 'plants', label: 'Plants' },
    { id: 'fish', label: 'Fish' },
    { id: 'bills', label: 'Bills' },
    { id: 'events', label: 'Events' },
    { id: 'gill', label: "Gill" },
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
    if (tabId === 'water' || tabId === 'plants' || tabId === 'fish') {
      handleSwitchStatsPage(tabId);
    }
  };

  const dayNumber = gameState?.G?.gameTime ?? gameState?.ctx?.turn ?? null;
  const money = gameState?.G?.money ?? null;

  return (
    <div className="scene-shell">
      <header className="topbar" aria-label="Game header">
        <div className="topbar-left">
          <div className="topbar-title">Grow-n-Flow</div>
          <div className="topbar-stats">
            <span>Day: {dayNumber ?? '—'}</span>
            <span>Money: {money != null ? `$${Number(money).toFixed(2)}` : '—'}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button onClick={startNewGame} disabled={loading} className="btn-newgame" type="button">New Game</button>
          <button onClick={handleProgressTurn} disabled={loading || !connected} className="btn-progress" type="button">Progress Day</button>
        </div>
      </header>

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
                  <div className="selection-row"><strong>ID:</strong> {selectedFish.id ?? '—'}</div>
                  <div className="selection-row"><strong>Type:</strong> {selectedFish.type ?? '—'}</div>
                  <div className="selection-row"><strong>Health:</strong> {selectedFish.health ?? '—'}/10</div>
                  <div className="selection-row"><strong>Age:</strong> {selectedFish.age ?? '—'}d</div>
                  <div className="selection-row"><strong>Weight:</strong> {selectedFish.weight != null ? `${Math.round(Number(selectedFish.weight))}g` : '—'}</div>
                  <div className="selection-row"><strong>Harvest Weight:</strong> {selectedFish.harvestWeight ?? '—'}g</div>
                  <div className="selection-row"><strong>Harvest Time:</strong> {selectedFish.harvestTime ?? '—'}d</div>
                  <div className="selection-row"><strong>Market Value:</strong> {selectedFish.marketValue != null ? `$${Number(selectedFish.marketValue).toFixed(2)}/lb` : '—'}</div>
                  <div className="selection-row"><strong>Growth Rate:</strong> {selectedFish.growthRate ?? '—'}</div>
                  <div className="selection-row"><strong>Food Rate:</strong> {selectedFish.foodConsumptionRate ?? '—'}</div>
                  <div className="selection-row"><strong>Ammonia Rate:</strong> {selectedFish.ammoniaProductionRate ?? '—'}</div>
                  <div className="selection-row"><strong>Render Asset:</strong> {selectedFish.renderAsset ?? '—'}</div>
                  <div className="selection-row"><strong>Render Scale:</strong> {selectedFish.renderScale ?? '—'}</div>
                  <div className="selection-row"><strong>Render Position:</strong> {selectedFish.renderPosition ? `${selectedFish.renderPosition.x ?? '—'}, ${selectedFish.renderPosition.y ?? '—'}, ${selectedFish.renderPosition.z ?? '—'}` : '—'}</div>
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

          {activeTab === 'controls' && (
            <section className="control-section">
              <h2>🎛️ Controls</h2>
              <div className="picked-readout">
                <h3>Last clicked object</h3>
                <div className="picked-value">{lastPickedLabel}</div>
              </div>
              <div className="control-status">
                <div><strong>Status:</strong> {loading ? 'Connecting…' : connected ? 'Connected' : 'Disconnected'}</div>
              </div>
              <div className="action-buttons">
                <button onClick={handleRepairSystem} disabled={loading || !connected} className="btn-secondary" type="button">Repair System</button>
              </div>
            </section>
          )}

          {activeTab !== 'controls' && !gameState && (
            <section>
              <h2>Loading</h2>
              <p className="empty-message">Waiting for game state…</p>
            </section>
          )}

          {activeTab === 'water' && gameState && (
            <WaterSection gameState={gameState} loading={loading} />
          )}

          {activeTab === 'plants' && gameState && (
            <PlantsSection
              gameState={gameState}
              loading={loading}
              handleHarvestPlant={handleHarvestPlant}
              handlePlantSeed={handlePlantSeed}
              handleBuyAllSeeds={handleBuyAllSeeds}
            />
          )}

          {activeTab === 'fish' && gameState && (
            <FishTankSection
              gameState={gameState}
              loading={loading}
              handleAddFish={handleAddFish}
              handleSellFish={handleSellFish}
              handleFeedFish={handleFeedFish}
            />
          )}

          {activeTab === 'bills' && gameState && (
            <BillsPanel gameState={gameState} />
          )}

          {activeTab === 'events' && gameState && (
            <EventsPanel gameState={gameState} onRepair={handleRepairSystem} />
          )}

          {activeTab === 'gill' && (
            <section className="gill-section">
              <h2>🧠 Gill’s Advice</h2>
              <GillPopup
                gillText={gillText || 'No advice yet. Click Water/Plants/Fish tabs to get guidance.'}
                active={true}
                inline={true}
                onClose={deactivateGill}
              />
              {gillActive && (
                <div className="action-buttons">
                  <button className="btn-secondary" onClick={deactivateGill} type="button">Clear</button>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default Game;