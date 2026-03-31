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

      <div className="scene-layer">
        <Renderer gameState={gameState} />
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