# Grow-n-Flow Backend

A boardgame.io-powered Node.js backend for the Grow-n-Flow aquaponics simulation game. This server manages real-time aquaponics system simulation with multiplayer support.

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

### Running the Server

Run the simulation server:
```bash
node src/index.js
```

The server will start at `http://localhost:4000`

## 🧪 Testing the Server

### Health Check
```bash
curl http://localhost:4000
```
Expected response: `Aquaponics backend running.`

### API Health Check
```bash
curl http://localhost:4000/api
```
Expected response: `{"message":"API is running"}`

### Game Testing

1. **Create a game:**
```bash
curl -X POST http://localhost:8000/games/aquaponics/create \
  -H "Content-Type: application/json" \
  -d '{"numPlayers": 1}'
```

2. **Join the game (replace GAME_ID):**
```bash
curl -X POST http://localhost:8000/games/aquaponics/GAME_ID/join \
  -H "Content-Type: application/json" \
  -d '{"playerID": "0", "playerName": "Player1"}'
```

3. **Test moves (replace GAME_ID):**

Plant a seed:
```bash
curl -X POST http://localhost:8000/games/aquaponics/GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{"type": "plantSeed", "args": ["lettuce", 1], "playerID": "0"}'
```

Feed fish:
```bash
curl -X POST http://localhost:8000/games/aquaponics/GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{"type": "feedFish", "args": [1, 10], "playerID": "0"}'
```

Buy equipment:
```bash
curl -X POST http://localhost:8000/games/aquaponics/GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{"type": "buyEquipment", "args": ["water_heater"], "playerID": "0"}'
```

4. **Check game state:**
```bash
curl http://localhost:8000/games/aquaponics/GAME_ID
```

## 🏗 Architecture

### Core Components

- **boardgame.io Server** - Handles game state management and real-time synchronization
- **Aquaponics Simulation Engine** - Core logic for water cycles, nutrients, and plant growth
- **REST API** - Additional endpoints for simulation data and player management
- **Game Logic** - Move-based interactions for managing aquaponics systems

## 📁 Project Structure

```
backend/
├── src/
│   ├── index.js              # Server entry point
│   ├── app.js                # Express + boardgame.io setup
│   ├── game/
│   │   ├── game.js           # Main game definition
│   │   ├── moves/            # Player actions (plant, harvest, adjust)
│   │   ├── phases/           # Game phases (growing, harvesting)
│   │   └── simulation/       # Aquaponics simulation logic
│   ├── api/
│   │   ├── routes/           # REST API endpoints
│   │   └── controllers/      # Business logic
│   └── middleware/           # Authentication & validation
├── package.json
└── README.MD
```

## 🎮 Game Features

### Simulation Systems
- **Water Cycle Management** - pH, temperature, flow control
- **Nutrient Systems** - Nitrogen cycle, feeding schedules
- **Plant Growth** - Realistic growth algorithms based on aquaponics principles
- **Fish Management** - Fish health, feeding, waste production

### Player Actions (Moves)
- Plant seeds in grow beds
- Harvest mature crops
- Adjust water parameters
- Feed fish and manage tank conditions
- Monitor system health

## 🛠 API Integration

### boardgame.io Endpoints
- Game state synchronization
- Real-time move validation
- Multiplayer lobby management

### Custom REST Endpoints
- `/api/simulation` - Current simulation data
- `/api/game` - Game management
- Health check at `/`

## 🚀 Development

### Adding New Moves
Define player actions in `src/game/moves/`:
```javascript
export const newMove = (G, ctx, ...args) => {
  // Move logic here
};
```

### Simulation Updates
Add new simulation features in `src/game/simulation/`:
```javascript
export const newSimulation = (gameState) => {
  // Simulation calculations
  return updatedState;
};
```

## 🌱 Aquaponics Simulation

This backend simulates real aquaponics principles:
- Symbiotic relationship between fish and plants
- Nitrogen cycle management
- Water quality monitoring
- Sustainable food production mechanics

Built for educational and entertainment purposes to teach aquaponics concepts through interactive gameplay.