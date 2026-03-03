// src/components/Game.jsx
import React, { useState, useEffect } from 'react';
import gameAPI from '../services/gameAPI';
import Renderer from './Renderer';
import StatsSection from './StatsSection';
import GillPopup from './GillPopup';
import BillsPanel from './BillsPanel';
import EventsPanel from './EventsPanel';
import "./Game.css"

function Game() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);

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

  const handlePlantSeed = (plantType) => {
    const bedLocation = `bed_${Date.now()}`;
    console.log('[Game] handlePlantSeed called:', plantType, bedLocation);
    gameAPI.plantSeed(plantType, bedLocation);
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

  if (!gameState || !gameState.G) {
    return <div className="loading">Initializing game...</div>;
  }

  const G = gameState.G;
  const ctx = gameState.ctx || {};

  return (
    <div className="game-container">
      <header className="game-header">
        <h1>🐟 Grow-n-Flow Aquaponics 🌱</h1>
        <div className="game-stats">
          <span>💰 Money: ${(Math.floor((G?.money || 0) * 100) / 100).toFixed(2)}</span>
          <span>⏰ Day: {G?.gameTime || 0}</span>
        </div>
      </header>

      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="game-grid">

        <section className="renderer-section">
          <Renderer />
        </section>
        
        {/* Control Panel */}
        <section className="control-section">
          <h2>🎮 Game Controls</h2>
          <button 
            onClick={handleProgressTurn} 
            disabled={loading}
            className="btn-turn"
          >
            Progress Turn ⏭️
          </button>
          <button 
            onClick={startNewGame} 
            disabled={loading}
            className="btn-danger"
          >
            New Game 🆕
          </button>
        </section>

        <BillsPanel gameState={gameState} />
        <EventsPanel gameState={gameState} onRepair={handleRepairSystem} />

        <GillPopup gillText={gillText} active={gillActive} onClose={deactivateGill} />
        <section className="popup-section">
          <StatsSection gameState={gameState} loading={loading} handleAddFish={handleAddFish} handleFeedFish={handleFeedFish} handlePlantSeed={handlePlantSeed} handleHarvestPlant={handleHarvestPlant} handleSwitchPage={handleSwitchStatsPage}/>
        </section>

      </div>
      

      {loading && <div className="loading-overlay">Processing...</div>}
    </div>
  );
}

export default Game;