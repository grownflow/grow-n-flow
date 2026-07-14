# Grow-n-Flow — System Architecture

*Written: 2026-06-24*

---

## 1. Overview

Grow-n-Flow is a single-player aquaponics farm simulation game. Players manage a living
ecosystem — fish, plants, water chemistry, and equipment — across a 100-day game, balancing
biological stability against financial growth. The system has two distinct runtime modes that
share the same core simulation engine:

**Interactive mode** — a player operates the farm through a browser-based React UI. Each action
(buying a fish, progressing a day, repairing a pump) travels as an HTTP request to a Node.js
server, which mutates game state, persists it to MongoDB, and returns the updated state to the
browser for re-rendering.

**Headless simulation mode** — a Node.js script instantiates bot-controlled games in-process,
calling the same game engine functions directly without any HTTP or database overhead. This is
used to run 100,000 games across four strategy archetypes to measure balance and tune mechanics.

The two modes share a single source of truth: the game engine in
`backend/src/game/moves/systemMoves.js` and the surrounding move files. Every mechanic that a
human player encounters is the same mechanic the bots encounter.

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 · Vite · Axios · X3DOM (WebGL 3D) |
| Backend | Node.js · Express 4 · boardgame.io (Koa transport) |
| Database | MongoDB (via native driver, not Mongoose) |
| Session | express-session + connect-mongo (7-day TTL) |
| Simulation | Node.js in-process, no HTTP |
| 3D Assets | X3D scene files (.x3d) for fish, GLB for plants |

---

## 3. System Topology

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         INTERACTIVE MODE                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   ┌──────────────────────────────┐   HTTP / JSON   ┌──────────────────────┐ ║
║   │  BROWSER (port 5173)         │ ◄─────────────► │  EXPRESS (port 4000) │ ║
║   │                              │                  │                      │ ║
║   │  React SPA (Vite)            │                  │  /api/auth/*         │ ║
║   │   App.jsx — auth gate        │                  │  /api/games/*        │ ║
║   │   Game.jsx — orchestrator    │                  │                      │ ║
║   │   gameAPI — 1s poll + moves  │                  │  MatchHandler        │ ║
║   │   Renderer — X3DOM 3D scene  │                  │   load G from Mongo  │ ║
║   │   8 UI panels (tabs)         │                  │   deserialize        │ ║
║   │                              │                  │   call move fn       │ ║
║   └──────────────────────────────┘                  │   save G to Mongo    │ ║
║                                                      └──────────┬───────────┘ ║
║                                                                 │             ║
║                                                    ┌────────────▼───────────┐ ║
║                                                    │  GAME ENGINE           │ ║
║                                                    │  (shared with sim)     │ ║
║                                                    │  systemMoves.js        │ ║
║                                                    │  fishMoves.js          │ ║
║                                                    │  plantMoves.js         │ ║
║                                                    │  economyMoves.js       │ ║
║                                                    └────────────┬───────────┘ ║
║                                                                 │             ║
║                                                    ┌────────────▼───────────┐ ║
║                                                    │  MONGODB               │ ║
║                                                    │  users                 │ ║
║                                                    │  matches  (G + ctx)    │ ║
║                                                    │  water_readings        │ ║
║                                                    │  sessions              │ ║
║                                                    └────────────────────────┘ ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║                         HEADLESS SIMULATION MODE                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   scripts/run-100k.js                                                        ║
║     │                                                                        ║
║     └─► SimulationRunner.runSingleGame(strategy)                             ║
║           │                                                                  ║
║           ├─► AquaponicsGame.setup()    → fresh G (RAM only, no MongoDB)    ║
║           ├─► Bot.makeDecision(G)       → decision (move name + args)       ║
║           ├─► moves[moveName]({G,ctx})  → mutate G  ← same engine as above ║
║           ├─► GameAnalytics.recordDay() → collect telemetry                 ║
║           └─► Repeat until day 100 / success / bankruptcy                   ║
║                                                                              ║
║   Outputs: simulation-results-100k.csv  (per-strategy aggregate)            ║
║            simulation-games-100k.csv    (100,000 per-game rows)             ║
║            simulation-snapshots-100k.csv (10-day snapshots)                 ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Backend

### 4.1 Entry Point and Server Setup

The backend starts in `backend/src/index.js`, which performs three sequential tasks: it connects
to MongoDB using the `MONGO_URI` environment variable, then starts the Express API server on port
4000, and finally starts the boardgame.io Koa transport server on port 8000. The Express server
handles all REST API traffic. The boardgame.io server is a legacy scaffold; the frontend does
not use its WebSocket protocol and instead interacts exclusively through the Express REST routes.

`backend/src/app.js` configures Express with CORS (origin allowlist from `FRONTEND_ORIGIN`),
JSON body parsing, security headers (X-Frame-Options, CSP), and MongoDB-backed session storage
using `express-session` with `connect-mongo`. Sessions are keyed by cookie `gnf.sid` with a
seven-day TTL.

### 4.2 API Routes

All routes are mounted at `/api` by `backend/src/api/routes/index.js`, which delegates to two
sub-routers.

`routes/auth.js` provides four endpoints: `POST /api/auth/register` creates a user record with
a bcrypt-hashed password and sets a session; `POST /api/auth/login` validates credentials and
sets a session; `GET /api/auth/me` returns the logged-in user or a 401; `POST /api/auth/logout`
destroys the session.

`routes/games.js` provides the game lifecycle endpoints, all protected by `requireAuth`
middleware. `POST /api/games/aquaponics/create` generates a fresh match by calling
`AquaponicsGame.setup()` and writing the result to MongoDB. `POST
/api/games/aquaponics/resume` loads the user's most recent active match or creates a new one if
none exists. `GET /api/games/aquaponics/{matchID}` fetches current game state. `POST
/api/games/aquaponics/{matchID}/move` is the primary game endpoint — it receives a move name
and argument array, executes the move through `MatchHandler`, and returns the updated state.
`GET /api/games/aquaponics/{matchID}/water-history` returns the `water_readings` timeseries for
charting.

### 4.3 Match Handler

`backend/src/api/matchHandler.js` is the glue layer between the HTTP routes and the game
engine. Its `makeMove` method performs five steps in sequence.

First it loads the match document from the `matches` MongoDB collection, which contains the
entire game state serialized as a plain JSON object. Second it deserializes that plain JSON back
into class instances — `Fish`, `Plant`, `Tank`, `WaterChemistry`, and related model objects —
because the move functions expect objects with methods. Third it locates the requested move
function by name in `AquaponicsGame.moves` and calls it with the signature
`moveFn({ G, ctx }, ...args)`, which mutates `G` in-place. Fourth, if the move was
`progressTurn` or `progressMultipleTurns`, it writes a water chemistry snapshot to the
`water_readings` collection for historical charting. Fifth it serializes the mutated `G` back to
plain JSON and writes it to MongoDB, then returns `{ G, ctx }` as the HTTP response body.

The serialization round-trip — plain JSON → class instances → move executes → plain JSON — means
MongoDB always stores a pure data document with no code references. The deserialization step
reconstructs the behavioral shell (class methods) on every request, which is stateless and
correct for a single-player REST model.

### 4.4 Game Engine

The game engine is defined in `backend/src/game/game.js` as the `AquaponicsGame` object, which
follows the boardgame.io game definition contract. Its `setup()` function returns the initial
game state `G`: a 1000 L tank at 55% biofilter efficiency, 5 mg/L starting nitrate, pH 7.0,
dissolved oxygen 8.0 mg/L, $1,000 cash, and one free biofilter unit in inventory. The `moves`
property is an aggregation of all move functions imported from the four move modules.

The moves are split across four files by domain:

**`systemMoves.js`** owns the simulation core. Its `runOneTurn` function is called by both
`progressTurn` (one day) and `progressMultipleTurns` (up to ten days, with early-exit logic).
`runOneTurn` executes a fixed nine-phase pipeline on each call (see Figure 2 below). The file
also implements `repairSystem`, `quickRepairSystem`, `performPartialWaterChange`,
`increaseAeration`, and `applyConsumable`.

**`fishMoves.js`** handles fish lifecycle: `addFish` buys fingerlings and appends them to
`G.fish`; `feedFish` loads food into the tank; `sellFish` converts a harvestable fish to cash.

**`plantMoves.js`** handles plant lifecycle: `plantSeed` and `plantSeedsBulk` create plant
objects and assign 3D grow-bed slots; `harvestPlant` and `harvestAllMaturePlants` move mature
plants to `G.inventory.produce`. When a single bulk harvest collects 15 or more plants, all
unit prices are multiplied by 1.15 (bulk harvest bonus).

**`economyMoves.js`** handles market transactions: `buyEquipment` adds items to `G.equipment`
inventory; `sellProducts` converts harvested produce to cash; `setAutoFeed` toggles automatic
daily feeding.

### 4.5 The runOneTurn Pipeline

This is the biological heart of the game. Every call to `progressTurn` executes these phases in
order:

```
runOneTurn(G)
│
├─ 1. EVENT PROMOTION
│     Pending event (shown as warning) → becomes active event (effects apply now)
│     Skipped when called from progressMultipleTurns for newly-detected events
│     (ensures player always sees 1 warning turn before effects begin)
│
├─ 2. ACTIVE EVENT EFFECTS
│     EventManager.applyEventEffects(G)
│     ├─ waterLeak:      volume drains 50 L/day
│     ├─ pumpFailure:    circulation drops to 15% → nitrification suppressed
│     ├─ filterClog:     biofilterEfficiency halved
│     ├─ ammoniaSpike:   ammonia +1.5 ppm
│     └─ plantDisease:   nitrate −2 ppm, iron −0.5 ppm, plant health −1.2/day
│
├─ 3. TIME + BIOFILTER MATURATION
│     G.gameTime += 1
│     if gameTime ≤ 14:
│       biofilterEfficiency += (0.80 − 0.55) / 14  ≈ +0.018/day
│     (rises automatically 55% → 80% as bacterial colony establishes)
│
├─ 4. TEMPERATURE DRIFT
│     Ornstein-Uhlenbeck random walk returning toward 25 °C
│     heaterChiller equipment tightens drift ±0.5 °C → ±0.15 °C
│
├─ 5. AUTO-FEED + FISH FEEDING
│     if G.autoFeed: draw food from G.fishFood into tank.foodInTank
│     applyDailyFishFeedingFromTank():
│       ├─ Distribute tank food among fish proportionally to body weight
│       ├─ Each fish: weight += portion × growthRate × stressMultiplier
│       ├─ Ammonia generated: portion × 0.25 + fishAmmoniaRate × 1.0
│       ├─ Starving fish (5+ days unfed): health declines toward death
│       └─ Dead fish collected for lastAction.fishDeaths
│
├─ 6. NITROGEN CYCLE (nitrification)
│     capacity = BASE_BIOFILTER_CAPACITY × biofilterEfficiency
│               = 2.5 × efficiency  ppm/day
│     ammonia removed  = min(ammonia, capacity)
│     nitrite removed  = min(nitrite, capacity)
│     water.nitrate   += nitriteToNitrate          (accumulates as plant food)
│     water.pH        -= 0.01 × (ammoniaToNitrite + nitriteToNitrate)
│
├─ 7. DISSOLVED OXYGEN REPLENISHMENT
│     if circulation not stopped:
│       deficit = 8.0 − dissolvedOxygen
│       DO += 0.25 × deficit × circulationEfficiency
│
├─ 8. PLANT NITRATE UPTAKE
│     if lights on:
│       each plant: uptake by growthStage (seedling 0.02, growing 0.04, mature 0.06 ppm)
│       water.nitrate = max(0, nitrate − totalUptake)
│
├─ 9. STABLE ECOSYSTEM STREAK
│     if ammonia < 1.2 && DO > 6.0 && pH 6.5–7.5:
│       G.stableEcosystemDays += 1
│       if stableEcosystemDays == 10: award $100 + growth multipliers (once)
│     else: reset streak to 0
│
├─ 10. PLANT GROWTH & MORTALITY
│      nitrateGrowthMult = clamp(0.85 + (nitrate − 5)/75 × 0.30, 0.85, 1.15)
│      for each plant:
│        plant.age += nitrateGrowthMult × ecosystemBonus
│        advance stage: seedling → growing → mature (at species totalGrowthTime)
│        health penalty: nitrate < 3 ppm → −(3 − nitrate) × 0.4/day
│        health penalty: iron < 1 ppm → −0.5/day
│        health penalty: pH out of range → −0.6 to −1.2/day
│        health recovery: +0.15/day when all conditions good
│        plant.health ≤ 0 → collected for lastAction.plantDeaths
│
├─ 11. AMMONIA TOXICITY DRAIN
│      if ammonia > 1.5 ppm:
│        excess = ammonia − 1.5
│        each fish:  health −= excess × 0.2
│        each plant: health −= excess × 0.15
│
├─ 12. DAILY UTILITY COSTS & BILLING
│      electricity += pump + lighting + heaterChiller × 0.1 per day
│      water += tankSize × evaporation + fishCount × 0.08 per day
│      if gameTime % 30 == 0:  (billing day)
│        G.money −= (electricity + water)
│        if fishCount > 0 && ammonia < 1.5: G.money += fishCount × $5  (healthy-pop bonus)
│        billsAccrued.reset()
│
├─ 13. MILESTONE CHECK
│      money ≥ $1,500 → "Established"
│      money ≥ $2,500 → "Profitable"
│      money ≥ $5,000 → "Thriving" (game ends, success outcome)
│
└─ 14. EVENT DETECTION
       EventManager.detectPendingEvent(G)
       ├─ Roll each event's probability independently
       ├─ Mechanical events (pump, filter, leak): probability × 0.5 if ammonia < 0.5 ppm
       ├─ filterClog: probability × min(3.0, 1.0 + (fishCount − 5) × 0.2)
       ├─ schoolTour: only if ammonia < 0.5 ppm (ammoniaThreshold guard)
       └─ Winner stored in G.pendingEvent (player sees 1-turn warning)
```

### 4.6 EventManager

`backend/src/game/utils/EventManager.js` owns event probability rolling, promotion, and effect
application. It maintains the two-phase warning system: a detected event sits in `G.pendingEvent`
for one full game turn (the player sees it as "Upcoming: …" in the UI) before being promoted to
`G.activeEvent` and beginning to apply effects. When `progressMultipleTurns` is called, events
detected *during* the batch are never promoted within the same batch — the player is guaranteed
a warning turn before effects apply, regardless of how many days are advanced at once.

The mechanical event probability modifier is the key balance lever: pump failure, filter clog,
and water leak all run at half probability when ammonia is below 0.5 ppm. This directly rewards
clean-water management (Conservative and Reactive strategies) with fewer system failures.

### 4.7 Data Catalog

Four static data files define the game's parameter space. They are imported by both the game
engine (which uses them for simulation mechanics) and the frontend (which uses them for UI
display).

**`fishSpecies.js`** defines tilapia, barramundi, and catfish. Each species carries temperature
tolerances, harvest weight and time, market value, fingerling cost, ammonia production rate, and
food consumption rate. Tilapia is the beginner species (cheap, hardy, fast); barramundi is the
premium species (more expensive, higher value, narrower temperature tolerance); catfish is
defined but unused by any current bot strategy.

**`plantSpecies.js`** defines five species across three categories. Basil (herb, 5 days) and
Parris Island Romaine (leafy green, 6 days) are the fast-cycle cash crops used by bots.
Rosemary (10 days), Tomato (14 days), and Pepper (15 days) are slower-growing premium options
available to human players.

**`equipment.js`** catalogs eight purchasable items: fish food, biofilter units, aeration stones,
calcium and potassium buffering solutions, chelated iron, heater/chiller, and grow lights. Each
item specifies cost, consumable type, and a `waterEffects` map that `applyConsumable` applies
to the tank.

**`events.js`** defines twelve events in two types. Technical events (pump failure, filter clog,
water leak, ammonia spike, nitrite rise, low dissolved oxygen, pH crash, fish disease, plant
disease) specify probability, severity, duration, per-turn effects, and repair costs. Social
events (school tour, market bonus) specify probability, cash award, and optional preconditions
such as the ammonia threshold guard on the school tour.

### 4.8 MongoDB Schema

```
Collection: matches
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   matchID:      "gnf_a1b2c3",                                  │
│   ownerUserId:  ObjectId("..."),                                │
│   status:       "active" | "archived" | "completed",           │
│   gameTime:     42,          ← denormalized from G for queries  │
│   G: {                       ← full game state as plain JSON    │
│     money: 1850.50,                                             │
│     fish: [ { id, type, weight, health, age, ... } ],          │
│     plants: [ { id, type, growthStage, health, age, ... } ],   │
│     aquaponicsSystem: {                                         │
│       tank: {                                                   │
│         water: { ammonia, nitrite, nitrate, pH, DO, ... },      │
│         biofilterEfficiency, currentVolume, capacity, ...       │
│       },                                                        │
│       growBeds: { bed1: {...}, bed2: {...}, bed3: {...} }       │
│     },                                                          │
│     equipment: { biofilter: 1, aerationStones: 5, ... },       │
│     activeEvent: null | { id, name, turnsRemaining, ... },      │
│     pendingEvent: null | { id, name, ... },                     │
│     lastAction: { type, fishDeaths, plantDeaths, ... }          │
│   },                                                            │
│   ctx: { currentPlayer: "0", turn: 43, ... },                  │
│   createdAt, updatedAt                                          │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

Collection: water_readings   (one document per game-day per match)
┌─────────────────────────────────────────────────────────────────┐
│ {                                                               │
│   matchID:    "gnf_a1b2c3",                                    │
│   gameTime:   42,                                               │
│   water:      { ammonia, nitrite, nitrate, pH, DO, temp, ... } │
│   tank:       { capacity, currentVolume, biofilterEfficiency }  │
│   fishDeaths:  0,                                               │
│   plantDeaths: 1,                                               │
│   event:      { id, type, severity } | null,                   │
│   createdAt                                                     │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. A Move's Journey: "Progress Day"

This trace follows a single button click through the full stack to illustrate how the layers
connect.

```
BROWSER
  │
  │  User clicks "Progress Day"
  ▼
Game.jsx: handleProgressDay()
  │
  ▼
gameAPI.progressTurn()
  │  POST /api/games/aquaponics/gnf_a1b2c3/move
  │  Body: { move: "progressTurn", args: [], playerID: "0" }
  ▼
Express: routes/games.js
  │  requireAuth() → validate session cookie gnf.sid
  │  matchHandler.makeMove("gnf_a1b2c3", "progressTurn", [], "0")
  ▼
MatchHandler.makeMove()
  │  1. Load match from MongoDB.matches (G as plain JSON)
  │  2. Deserialize: Fish[], Plant[], Tank, WaterChemistry ← class instances
  │  3. moveFn = AquaponicsGame.moves["progressTurn"]
  │  4. moveFn({ G, ctx })  ← mutates G in-place
  ▼
systemMoves.progressTurn({ G, ctx })
  │  runOneTurn(G)  ← 14-phase pipeline (see §4.5)
  │  G.gameTime: 41 → 42
  │  G.money: 1800.00 → 1850.50   (healthy-pop billing bonus day)
  │  G.lastAction = { type: "progressTurn", fishDeaths: [], ... }
  ▼
MatchHandler (continued)
  │  5. recordWaterReading("gnf_a1b2c3", G) → write to water_readings
  │  6. Update MongoDB.matches: G + ctx + gameTime=42 + updatedAt=now
  │  7. Return { G, ctx }
  ▼
HTTP Response 200 OK
  Body: { G: { money: 1850.50, gameTime: 42, fish: [...], ... }, ctx: {...} }
  ▼
gameAPI._fetchAndNotify()   (immediate re-fetch after move, no wait for poll)
  │  setGameState(state) → React state update
  ▼
React re-renders all children:
  ├─ StatsSection:     $1,850.50 (updated from $1,800.00)
  ├─ WaterSection:     ammonia 0.04 ppm (green), nitrate 48 ppm
  ├─ FishTankSection:  tilapia weight 592 g (harvestable soon)
  ├─ PlantsSection:    basil "mature" → harvest button enabled
  ├─ EventsPanel:      "Upcoming: Ammonia Spike — prepare now" (amber)
  └─ Renderer:         X3DOM scene updated: fish scale/position, plant models
```

---

## 6. Frontend

### 6.1 Structure

The frontend is a React 19 single-page application built with Vite. It lives entirely in
`FlowFarmFrontend/src/` and communicates with the backend exclusively via HTTP. There is no
WebSocket connection and no shared in-memory state between browser tabs — all persistent state
lives in MongoDB and is delivered as the G object in API responses.

```
FlowFarmFrontend/src/
│
├── main.jsx              React entry point; mounts <App />
├── App.jsx               Auth gate — shows login/register or <Game />
│
├── components/
│   ├── Game.jsx          ← Orchestrator: match lifecycle, polling, move dispatch
│   ├── Renderer.jsx      ← X3DOM 3D scene (fish, grow beds, tank)
│   ├── StatsSection.jsx  ← Money, day counter, milestones
│   ├── WaterSection.jsx  ← Water chemistry display + trend charts + quick-fix banners
│   ├── FishTankSection.jsx
│   ├── PlantsSection.jsx
│   ├── MarketPanel.jsx
│   ├── BillsPanel.jsx
│   ├── EventsPanel.jsx
│   ├── InventoryPanel.jsx
│   └── GillPopup.jsx     ← Detail tooltip
│
├── services/
│   ├── gameAPI.js        ← HTTP REST client + 1-second polling loop
│   ├── authAPI.js        ← Login / register / logout / me
│   └── soundManager.js   ← Audio triggers per event type
│
└── config/
    └── plantSlots.js     ← 140 3D slot positions across 3 grow beds
```

### 6.2 Auth and Session Gate

`App.jsx` is the entry-level auth gate. On mount it calls `authAPI.me()` — a `GET
/api/auth/me` request — to check whether the browser session is already authenticated. If the
response returns a user object the app renders `<Game />` immediately. If it returns a 401 the
app renders the login/register form. The entire UI below `App.jsx` is therefore protected from
rendering before auth is confirmed.

Login and registration both call their respective endpoints, which set an HTTP-only session
cookie on success. Subsequent API requests from `gameAPI` and `authAPI` carry this cookie
automatically via `withCredentials: true` on the Axios instance.

### 6.3 Game Orchestrator (Game.jsx)

`Game.jsx` is the central coordinator. It owns:

- **Match lifecycle**: on mount it calls `gameAPI.createMatch({ mode: 'resume' })`, which
  attempts to resume the user's most recent active match or creates a new one. The match ID
  is stored in the `gameAPI` singleton for all subsequent requests.

- **State container**: `gameState` is the single React state value that holds the entire
  `{ G, ctx }` object returned by the backend. All child panels receive `gameState` as a
  prop and derive their display values from it.

- **Tab navigation**: the active tab (`market`, `fish`, `plants`, `water`, `bills`, `events`,
  `inventory`) determines which panel component is rendered in the main content area.

- **Move dispatch**: button handlers in `Game.jsx` call the appropriate `gameAPI` method
  (`addFish`, `progressTurn`, `repairSystem`, etc.), which sends the HTTP request and
  triggers an immediate state refresh on return.

- **Turn notification banner**: after each `progressTurn` or `progressMultipleTurns` move
  completes, `Game.jsx` inspects `G.lastAction` and displays a timestamped banner listing
  fish deaths, plant deaths, bills paid, milestone reached, pending events, and whether
  Progress 3 Days stopped early and why.

### 6.4 State Polling

`gameAPI.js` maintains a 1-second `setInterval` that fetches `GET
/api/games/aquaponics/{matchID}` and calls `onStateChange(state)` whenever the returned state
differs from the cached copy. In practice — because this is a single-player game with no
server-side autonomous processes — the poll rarely detects a change between player actions. Its
primary purpose is resilience: if a tab is left open, it will reflect any state change that
originated from another tab or session.

After every `makeMove` call, `gameAPI` immediately fetches the new state without waiting for
the next poll tick, so the UI updates feel synchronous from the player's perspective despite
the HTTP round-trip.

### 6.5 Component Tree and Data Flow

```
App.jsx  (auth state: user | null)
│
└── Game.jsx  (gameState: { G, ctx })
    │                     │
    │     ┌───────────────┼───────────────────────────────────┐
    │     │               │                                   │
    ▼     ▼               ▼                                   ▼
Renderer  StatsSection    [active tab panel]             Tab Nav Bar
(X3DOM)   (money, day,    │
           milestones)    ├── MarketPanel      (G.equipment, G.money)
                          ├── FishTankSection  (G.fish, G.aquaponicsSystem)
                          ├── PlantsSection    (G.plants, G.aquaponicsSystem)
                          ├── WaterSection     (G.aquaponicsSystem.tank)
                          ├── BillsPanel       (G.billsAccrued, G.gameTime)
                          ├── EventsPanel      (G.activeEvent, G.pendingEvent)
                          └── InventoryPanel   (G.inventory, G.money)

Data flows strictly downward: Game.jsx passes gameState as props.
No child component calls the API directly for game state — only Game.jsx owns moves.
Exception: WaterSection calls gameAPI.getWaterHistory() for its trend charts,
because that data is not in G (it lives in the water_readings collection).
```

### 6.6 The 3D Renderer (Renderer.jsx)

`Renderer.jsx` embeds an X3DOM scene as inline JSX. X3DOM renders WebGL from declarative X3D
XML, which React treats as a custom element tree. Fish are represented as `.x3d` model files
(e.g. `Redheadx.x3d` for tilapia) positioned within the tank bounding box defined by
`renderBounds.js`. Plants are `.glb` files placed at the 3D slot coordinates from
`plantSlots.js`. When a fish or plant dies, its React element is unmounted and X3DOM removes
the geometry from the scene.

The renderer receives `G.fish`, `G.plants`, and `G.aquaponicsSystem` from `gameState` and
re-renders whenever the parent `Game.jsx` state updates — which happens after every move. Fish
scale in the 3D scene corresponds to their weight relative to harvest weight; plants shift from
small seedling models to full-size crop models as their `growthStage` advances.

### 6.7 The Water Chemistry Panel (WaterSection.jsx)

`WaterSection.jsx` is the most complex UI panel. It integrates real-time parameter display,
historical trend charts, automatic warning/danger banners, and a supplement application
interface.

```
WaterSection
│
├── Nitrogen Trend Chart   (Ammonia / Nitrite, ammonia + nitrite vs. time)
│     Data: water_readings collection via gameAPI.getWaterHistory()
│     Re-fetched on every gameTime change (useEffect dependency)
│     Fish and plant death events overlaid as colored tick marks
│
├── Nitrate Trend Chart    (Nitrate vs. time, independently scaled)
│     Same data source as above, separate Y-axis
│
├── Automated Banners (conditional, highest-priority first):
│   ├── Active Event Effects  (shows current event's chemistry impact)
│   ├── ⚠ Elevated Ammonia/Nitrite    (shows when NH₃ > 0.5 or NO₂ > 0.25)
│   │     Button: Apply Biofilter [stock] or Buy Biofilter & Apply ($120)
│   ├── 🚨 Nitrate Deficiency / ⚠ Low Nitrate  (shows when NO₃ < 5 ppm with plants)
│   │     Red below 3 ppm (active health damage), yellow 3–5 ppm (warning zone)
│   │     Guidance text: add fish or harvest mature plants
│   └── ⚠ Low Dissolved Oxygen       (shows when DO < 5 mg/L)
│         Button: Apply Aeration Stone or Buy Pack & Apply ($25)
│
├── Nitrogen Parameters    (WaterStat cards: Ammonia, Nitrite, Nitrate)
│     Each card: current value, color-coded status, ideal range label
│     Ammonia:  green < 0.5, yellow 0.5–1.0, red ≥ 1.0
│     Nitrite:  green < 0.25, yellow 0.25–0.5, red ≥ 0.5
│     Nitrate:  green 5–80, yellow 3–5 or > 80, red < 3  ← damage threshold
│
├── Core Parameters        (WaterStat cards: pH, Temperature, Dissolved O₂)
│     pH:  green 6.5–7.5, yellow 6.2–6.5 or 7.5–7.8, red < 6.2 or > 7.8
│     Temp: green 18–30 °C, yellow outside
│     DO:   green ≥ 5 mg/L, yellow 3–5, red < 3
│
├── Micronutrient Parameters  (Iron, Phosphorus, Potassium, Calcium, Magnesium)
│
├── Stable Ecosystem Streak   (progress bar: X / 10 days)
│     Shows current count or active bonus indicator
│
├── System Alerts             (G.systemAlerts array from createSystemAlerts)
│     Text warnings generated server-side on each turn
│     Displayed as alert boxes with action guidance
│
├── Supplements               (apply consumables from inventory)
│     One row per item in G.equipment inventory
│     Each row: item name, effect description, "Apply" button
│
└── Water History Fetch
      useEffect → gameAPI.getWaterHistory({ limit: 200 })
      Fires on every gameTime change to refresh chart data
```

#### WaterStat Component

`WaterStat` is a reusable card component used by all parameter displays. It accepts a `value`,
two threshold modes (`thresholds` for one-directional danger like ammonia, or `rangeWarning` /
`rangeDanger` for two-sided ranges like pH and nitrate), and an `invertWarning` flag for
parameters where lower is worse (dissolved oxygen, iron). The component computes a `statusClass`
(`good`, `warning`, or `danger`) and applies the corresponding CSS color treatment.

### 6.8 The Events Panel (EventsPanel.jsx)

`EventsPanel.jsx` displays the current game event state and provides repair controls.

When no event is active or pending, the panel shows recent event history (if any) and tip text
reminding the player that good water quality reduces mechanical event frequency.

When `G.pendingEvent` is set, the panel shows an amber warning card with the event name,
description, and a countdown ("activates next turn"). For technical events that the player can
prepare for — like an upcoming filter clog — the panel shows the estimated repair cost and
suggests buying supplies if cash is low.

When `G.activeEvent` is set, the panel shows a red card with the event's ongoing effects and
two repair buttons: **Full Repair** (restores 100%, refills water on leaks, higher cost) and
**Quick Repair** (partial restoration at roughly half cost). The panel includes per-event
tooltips explaining the mechanical difference: quick repair on a water leak stops the drain but
does not refill the tank; full repair does both.

Event-specific response guidance is defined in a static `EVENT_RESPONSES` map in the component,
keyed by event ID. This keeps the guidance text in the UI layer and the event mechanics in the
engine — the two layers communicate only through `G.activeEvent.id`.

### 6.9 The Market Panel (MarketPanel.jsx)

`MarketPanel.jsx` presents the purchasing interface in three sections.

The first section is the equipment catalog, rendered from `backend/src/game/data/equipment.js`
data exposed through `G` or a catalog call. Each item shows its cost, a description of its
effect, the player's current stock, and a buy button that fires `gameAPI.buyEquipment()`. A
contextual education block below the biofilter entry explains how biofilter efficiency works and
when to apply a unit.

The second section is fish purchasing. The player selects a species (tilapia, barramundi), enters
a quantity, sees the total cost, and clicks Buy to fire `gameAPI.addFish()`. The panel shows
current tank fish count and the species' harvest time and market value for comparison.

The third section is the plant seed market. Species are listed with seed cost, grow time, and
harvest value per head. The player selects a species and quantity and clicks Plant.

### 6.10 Plant Slot Configuration (plantSlots.js)

`FlowFarmFrontend/src/config/plantSlots.js` defines the 140 spatial positions available for
plant placement across three grow beds. Each slot is an `{ x, y, z }` coordinate in the X3D
scene's coordinate space. The grow beds are rectangular arrays:

```
Bed 1:  4 columns × 9 rows  =  36 slots
Bed 2:  4 columns × 15 rows =  60 slots
Bed 3:  4 columns × 11 rows =  44 slots
                               ──────
Total:                        140 slots
```

When a seed is planted, `plantMoves.js` on the backend assigns the next available slot index to
the new plant object. `Renderer.jsx` reads the assigned slot index and uses `PLANT_SLOTS[index]`
to position the plant's 3D model. When a plant is harvested or dies, its slot is freed and
available for the next planting.

### 6.11 Sound Manager (soundManager.js)

`soundManager.js` maps game events to audio files. It is invoked from `Game.jsx` after move
responses are processed:

| Trigger | Sound file |
|---------|-----------|
| Progress Day | `universfield-video-game-bonus.mp3` |
| Progress 3 Days | `ribhavagrawal-achievement-video-game.mp3` |
| Event alert | `floraphonic-8-bit-game.mp3` |
| Feed fish | `pwlpl-power-up-game-sound-effect.mp3` |
| Harvest | `freesound_community-win-short.mp3` |
| Apply consumable | `dammafra-virtual-pet-happy.mp3` |

---

## 7. Headless Simulation

### 7.1 Overview

The simulation system in `backend/src/simulation/` provides a way to run thousands of games
programmatically to measure strategy balance. It bypasses every layer above the game engine:
no MongoDB, no HTTP, no session management. Game state is held entirely in RAM as a plain
JavaScript object and mutated directly by calling the same move functions the HTTP layer uses.

### 7.2 Bot Decision Pipeline

All bot strategies share a common decision loop defined in `Bot.js`. On each game day the bot
executes up to a configurable maximum number of non-turn-advance actions before finally returning
`null` to signal "advance the day." The decision steps run in fixed priority order:

```
1. handleCriticalIssues()
   └─ Repair active damage (pump, filter, leak)
      Stop feeding if ammonia is very high
      Emergency water change at critical ammonia

2. checkWaterChemistry()
   └─ Apply biofilter from inventory if ammonia > threshold
      Apply aeration stones if DO < threshold
      Perform water change if chemistry is degraded

3. checkHarvests()
   └─ Harvest all mature plants → G.inventory
      Sell produce from inventory
      Sell fish that have reached harvest weight

4. checkPurchases()
   └─ Buy fish food if running low
      Buy fingerlings if below max fish target
      Buy biofilter if ammonia load approaches capacity
      (strategy-specific thresholds for each decision)

5. checkFeeding()
   └─ Manually feed if auto-feed is off and food is in tank

6. return null  → advance day (progressTurn is called by runner)
```

### 7.3 Strategy Profiles

```
                    minMoney  maxFish  maxPlants  riskTol  Species
ConservativeBot:    $200      5        20         0.2      tilapia only
AggressiveBot:      $50       15       60         0.9      barramundi + tilapia
BalancedBot:        $150      11       30         0.5      tilapia + barramundi; heaterChiller after day 14
ReactiveBot:        $50       5        10         0.3      tilapia only, Romaine only
```

`AggressiveBot` buys barramundi when it can afford $6 (actual cost $5.10, buffer for rounding).
`BalancedBot` uniquely purchases a heater/chiller unit after day 14 to stabilize temperature for
barramundi and improve the stable-ecosystem streak probability.

### 7.4 Simulation Outputs

`scripts/run-100k.js` runs 100 games per batch across the four strategies, writing four output
files on completion:

```
backend/
├── simulation-results-100k.csv       Per-strategy aggregate (1 row per strategy)
├── simulation-results-100k.json      Same data plus breakdown of outcomes
├── simulation-games-100k.csv         Per-game row (100,000 rows): final money,
│                                     revenue, repair costs, deaths, events, etc.
└── simulation-snapshots-100k.csv     Per-10-day snapshot of each game
```

`SIMULATION-ANALYSIS.md` (project root) contains a full statistical breakdown of the 100k run:
distributions, percentiles, milestone outcomes, head-to-head win rates, and coefficient of
variation for all major metrics.

`SIMULATION-DELTA-R8-R9.md` documents the Round 8 → Round 9 delta after the nitrate deficiency
UX fix, which confirms the fix was UI-layer only and had no effect on simulation outcomes.

---

## 8. File Reference

| File | Purpose |
|------|---------|
| `backend/src/index.js` | Entry point: connect DB, start servers |
| `backend/src/app.js` | Express config, CORS, sessions |
| `backend/src/db/index.js` | MongoDB connection |
| `backend/src/api/routes/auth.js` | Auth endpoints |
| `backend/src/api/routes/games.js` | Game endpoints |
| `backend/src/api/matchHandler.js` | Serialize/deserialize/execute/persist |
| `backend/src/game/game.js` | boardgame.io game definition + setup() |
| `backend/src/game/moves/systemMoves.js` | runOneTurn + all system actions |
| `backend/src/game/moves/fishMoves.js` | Fish lifecycle |
| `backend/src/game/moves/plantMoves.js` | Plant lifecycle |
| `backend/src/game/moves/economyMoves.js` | Buying and selling |
| `backend/src/game/utils/EventManager.js` | Event detection, promotion, effects |
| `backend/src/game/data/fishSpecies.js` | Fish species parameters |
| `backend/src/game/data/plantSpecies.js` | Plant species parameters |
| `backend/src/game/data/equipment.js` | Equipment catalog |
| `backend/src/game/data/events.js` | Event library |
| `backend/src/game/data/renderBounds.js` | 3D scene bounding box |
| `backend/src/simulation/Bot.js` | Base bot class and decision pipeline |
| `backend/src/simulation/BotStrategies.js` | Four strategy implementations |
| `backend/src/simulation/GameAnalytics.js` | Per-game telemetry collector |
| `backend/src/simulation/SimulationRunner.js` | Batch runner |
| `backend/scripts/run-100k.js` | 100k simulation script |
| `FlowFarmFrontend/src/App.jsx` | Auth gate |
| `FlowFarmFrontend/src/components/Game.jsx` | Game orchestrator |
| `FlowFarmFrontend/src/components/Renderer.jsx` | X3DOM 3D scene |
| `FlowFarmFrontend/src/components/WaterSection.jsx` | Water chemistry UI |
| `FlowFarmFrontend/src/components/EventsPanel.jsx` | Event display and repair |
| `FlowFarmFrontend/src/components/MarketPanel.jsx` | Purchasing interface |
| `FlowFarmFrontend/src/services/gameAPI.js` | HTTP client + 1s polling |
| `FlowFarmFrontend/src/services/authAPI.js` | Auth API client |
| `FlowFarmFrontend/src/config/plantSlots.js` | 140 3D grow-bed slot positions |

---

## 9. How React, HTML, X3DOM, and the Backend Wire Together

This section traces the technical seams between the four layers — React's virtual DOM, the
browser's HTML document, X3DOM's WebGL renderer, and the Express/MongoDB backend — including
the specific workarounds required to make them cooperate.

### 9.1 React's Role: HTML Generator and State Machine

React renders the game UI as ordinary HTML. Everything the player sees in the sidebar — the tab
buttons, water chemistry cards, fish list, plant inventory, billing breakdown — is plain
`<div>`, `<button>`, `<table>`, and `<span>` elements that React builds and updates in the
browser's HTML DOM. React's reconciler computes the minimum set of DOM mutations needed to
bring the rendered tree in line with the current state object, then applies those mutations
imperatively.

The root state object is `gameState`, a single `useState` value in `Game.jsx` that holds the
full `{ G, ctx }` object returned by the backend API. Every child panel receives the portions
of `gameState` it needs as props. When `setGameState` is called with a new value — either by
the poll tick or by a post-move fetch — React re-renders every component that consumes the
changed props. Because `G` is replaced wholesale on every update (the backend returns a
complete snapshot, not a patch), React re-renders all panels on every server response.

```
Backend returns new { G, ctx }
    │
    ▼
gameAPI._onStateChange({ G, ctx })
    │  (gameAPI singleton calls this function)
    ▼
Game.jsx: setGameState({ G, ctx })
    │  (React state update — schedules a synchronous re-render)
    ▼
React reconciler runs
    │  Diffs virtual DOM tree vs. current DOM
    ├─ StatsSection: money text node → update text content
    ├─ WaterSection: ammonia value → update card text + maybe status class
    ├─ FishTankSection: fish list → reconcile list items (add/remove)
    ├─ PlantsSection: plant rows → reconcile (may show new "Mature" badge)
    └─ Renderer: fish and plant transform props → X3DOM node attribute updates
```

React does not know or care that some of the elements in that tree are X3DOM nodes rather than
HTML nodes. To React they are just custom elements with string props.

### 9.2 The gameAPI Singleton

`gameAPI.js` exports a single instance of the `GameAPI` class — `export default new GameAPI()`
— so every import in any component receives the same object. This singleton owns the match ID,
the cached state, and the polling interval handle. No component creates its own `GameAPI`
instance.

```
Module load time:
    gameAPI = new GameAPI()   ← one instance, shared by all importers
    gameAPI.matchID = null
    gameAPI.pollHandle = null
    gameAPI.state = null
    gameAPI._onStateChange = null

Game.jsx mounts:
    await gameAPI.createMatch(setGameState, { mode: 'resume' })
        │   POST /api/games/aquaponics/resume
        │   stores matchID → "gnf_a1b2c3"
        │   calls startPolling(setGameState)
        └── calls _fetchAndNotify() → first state delivery → setGameState({ G, ctx })

setInterval every 1000ms:
    GET /api/games/aquaponics/gnf_a1b2c3
    if response differs: setGameState(newState)

Button click anywhere in the app:
    gameAPI.makeMove('progressTurn', [])
        │  POST /api/games/aquaponics/gnf_a1b2c3/move
        │  awaits 200 OK
        └─ calls _fetchAndNotify() → setGameState(updatedState)
```

The polling and the post-move fetch both call the same `_onStateChange` callback — which is
just `Game.jsx`'s `setGameState`. From React's perspective every state update looks identical
regardless of whether it arrived via poll or via a move response. The `_fetchAndNotify` call
after `makeMove` bypasses the polling interval so that the UI update feels immediate from the
user's perspective.

The polling interval also snapshots `matchID` at the start of each tick and compares it to
`this.matchID` after the fetch returns. If the player switches games while a fetch is in-flight
the stale response is silently discarded, preventing a race condition between game switches
and in-flight HTTP responses.

### 9.3 HTML Structure of the Page

The page has three zones laid out by CSS:

```
<div class="App">                          ← App.jsx root
  <div class="game-layout">               ← Game.jsx wrapper
    │
    ├── [x3d ...]                         ← X3DOM canvas (full viewport background)
    │
    ├── <div class="stats-bar">           ← StatsSection: day, money, milestones
    │
    ├── <div class="panel">               ← Sidebar panel (conditionally visible)
    │   ├── <div class="tab-nav">         ← Tab buttons (Market / Water / Plants / …)
    │   └── <div class="tab-content">     ← Active panel component
    │
    └── <div class="turn-notification">   ← Turn result banner (conditional)
        <div class="tutorial-overlay">    ← Tutorial overlay (conditional)
```

The `<x3d>` element is positioned as a fixed-size background element. The sidebar panel and
stats bar are layered on top via CSS `position: absolute` / `z-index`. The player sees the 3D
scene through the transparent gaps in the HTML overlay. Clicks on HTML elements are handled by
normal browser event dispatch; clicks that fall through to the 3D canvas are handled by X3DOM's
pick mechanism.

### 9.4 How X3DOM Is Loaded

X3DOM is not installed as an npm package. It is loaded at runtime from the X3DOM CDN by
`X3DViewer.jsx`, using a pattern that avoids double-loading across React re-renders and hot
reloads:

```js
function ensureX3DOMLoaded() {
  if (window.x3dom) return Promise.resolve();       // already loaded, no-op

  if (!window.__x3domLoadingPromise) {              // first call: start the load
    window.__x3domLoadingPromise = new Promise((resolve, reject) => {
      // inject <link rel="stylesheet" href="x3dom.css"> into <head>
      // inject <script src="x3dom.js" async> into <head>
      script.addEventListener('load', resolve);
    });
  }

  return window.__x3domLoadingPromise;              // all callers share the same Promise
}
```

The `window.__x3domLoadingPromise` singleton means that if `X3DViewer` is mounted, unmounted,
and remounted (e.g., during development hot-reload), the second mount shares the existing
Promise and doesn't inject a second `<script>` tag. Once `x3dom.js` fires its `load` event,
`setReady(true)` is called and the component renders the `<x3d>` element. Before that point it
renders a `<div>Loading 3D…</div>` placeholder.

### 9.5 React Rendering X3D Elements

When `X3DViewer` renders, it returns JSX that includes both HTML elements and X3D elements in
the same tree:

```jsx
// X3DViewer.jsx returns:
<x3d ref={x3dRef} className="renderer-x3d-full" showstat="false">
  <scene>
    <background skycolor="0.85 1 0.92" />
    <inline url='"MainSceneb.x3d"' />
    {children}           ← Renderer.jsx injects viewpoints, transforms, inlines here
  </scene>
</x3d>
```

React does not know what `<x3d>`, `<scene>`, `<background>`, `<transform>`, `<inline>`, or
`<viewpoint>` mean. It treats them as unknown custom elements and creates them as generic DOM
nodes via `document.createElement`. X3DOM's script registers a MutationObserver on the
document; when it sees the `<x3d>` element appear in the DOM, it initializes a WebGL canvas
inside it and begins processing the X3D scene graph.

This means React can add, remove, and update X3D nodes just as it would HTML nodes, and X3DOM
will observe those mutations and update the WebGL scene accordingly. A fish that dies is simply
removed from `G.fish`, causing React to unmount its `<transform>` node, which X3DOM picks up
as a deletion and removes from the scene graph.

There is one important mismatch: React renders all JSX into the HTML namespace
(`document.createElement`), not the XML namespace (`document.createElementNS`). For most X3D
elements this does not matter because X3DOM's MutationObserver is namespace-agnostic. However,
some X3D attributes — particularly `NavigationInfo`'s `speed` attribute — are interpreted
differently in the HTML namespace. `X3DViewer` works around this by injecting `NavigationInfo`
directly via `document.createElement` / `setAttribute` after mount, bypassing React's JSX
pipeline entirely:

```js
useEffect(() => {
  if (!ready) return;
  const scene = x3dRef.current.querySelector('scene');
  if (!scene.querySelector('navigationinfo, NavigationInfo')) {
    const navInfo = document.createElement('NavigationInfo');
    navInfo.setAttribute('type', 'NONE');
    navInfo.setAttribute('speed', '1');
    scene.insertBefore(navInfo, scene.firstChild);
  }
}, [ready]);
```

### 9.6 The DEF/USE Asset Library Pattern

X3DOM has a DEF/USE mechanism for geometry reuse: the first `<inline DEF="NAME" url="...">` tag
loads the asset and names it; subsequent `<inline USE="NAME">` tags reference the already-loaded
geometry without re-fetching it. This means 15 tilapia fish all reference the same loaded
`.x3d` model rather than triggering 15 separate network requests.

React creates a problem for naïve DEF/USE usage: if the `DEF` node is the first `<inline>` in
the array (e.g., for fish index 0), and that fish dies, React unmounts the `DEF` node. At that
moment all other `USE` nodes in the scene still reference a now-removed DEF name, and X3DOM
drops a dangling-reference error.

`Renderer.jsx` solves this with a library pattern: a hidden `<transform scale="0 0 0">` at the
top of the scene holds exactly one `DEF` node for every unique asset that appears in any current
fish or plant. The actual fish and plant transform nodes use only `USE` references, never `DEF`.
Because the hidden library node is only unmounted when a given asset type disappears from
the game entirely (no more tilapia at all), the DEF is always present as long as any USE needs it.

```jsx
{/* Asset library — one DEF per unique asset, invisible via scale="0 0 0" */}
<transform scale="0 0 0">
  {uniquePlantAssets.map(asset => (
    <inline key={...} def={assetDefName('PLANT', asset)} url={`"${asset}"`} />
  ))}
  {uniqueFishAssets.map(asset => (
    <inline key={...} def={assetDefName('FISH', asset)} url={`"${asset}"`} />
  ))}
</transform>

{/* Each actual fish: USE only, no URL */}
{fish.map(f => (
  <transform translation="2.8 0.65 -1.05" scale="0.3 0.3 0.3">
    <inline use={assetDefName('FISH', assetPath)} />
  </transform>
))}
```

The `assetDefName` helper converts an asset path like `"plants/basil.glb"` to the string
`"PLANT_plants_basil_glb"`, which is a valid X3D DEF name (starts with a letter, only
alphanumerics and underscores).

### 9.7 Click / Pick Events: X3DOM → Game.jsx

HTML click events on `<button>` elements bubble up the DOM in the normal way. Click events on
3D objects work differently because X3DOM intercepts mouse events on the WebGL canvas, performs
a ray-cast intersection test against the scene geometry, and fires its own pick event on the
matched X3D node.

There is a further complication: X3DOM's pick event system was designed for XML attribute-style
inline handlers (`onclick="someFunction('id')"`), not for React's synthetic event system.
React's `onClick` prop sets an `addEventListener` on the DOM node, which is in the HTML
namespace — X3DOM's event dispatch may not bubble through HTML listeners reliably for all
X3DOM builds.

The application bridges this gap with two mechanisms working in tandem.

**Mechanism 1 — Global `window.__gnfPick`:** `Game.jsx` registers a global function on `window`
after mount:

```js
window.__gnfPick = (label) => {
  handlePicked({ label });
};
```

`X3DViewer.jsx` then walks all `[data-pick-label]` DOM nodes after X3DOM loads and sets
HTML-attribute-style `onclick` handlers on them:

```js
node.setAttribute('onclick', `window.__gnfPick && window.__gnfPick(${JSON.stringify(label)})`);
```

This runs in a retry loop (`20 attempts × 100 ms`) because X3DOM processes the scene graph
asynchronously; the DOM nodes may not be fully initialized immediately after React renders them.

**Mechanism 2 — Native click listener fallback:** `X3DViewer.jsx` also attaches a native
`addEventListener('click', ...)` to the root `<x3d>` element. The `getPickedLabelFromEvent`
helper probes multiple X3DOM-specific event properties (`event.hitObject`, `event.pickedObject`,
`event.detail.hitObject`, etc.) and walks the DOM parent chain looking for `data-pick-label`,
`id`, or `DEF` attributes. This catches clicks that X3DOM routes through its own event object
rather than through the inline-onclick path.

Both mechanisms call `handlePicked({ label })` in `Game.jsx`, which routes the label string to
the appropriate selection state:

```
"Plant_p_123abc"  →  setSelection({ kind: 'plant', id: 'p_123abc' })
"Fish_f_456def"   →  setSelection({ kind: 'fish',  id: 'f_456def' })
```

The selection state is consumed by `FishTankSection` and `PlantsSection` to highlight the
selected entity, and can be used to pre-populate forms (e.g., auto-selecting the clicked fish's
sell button).

### 9.8 Viewpoint Switching

The 3D scene contains six named `<viewpoint>` nodes defined in `Renderer.jsx`:

```
Viewpoint1 — Initial View (isometric overview)
Viewpoint2 — Fishtank (close-up)
Viewpoint3 — Filter equipment
Viewpoint4 — Bed 1
Viewpoint5 — Bed 2
Viewpoint6 — Bed 3
```

Game.jsx maintains `activeViewpoint` state (default `"Viewpoint1"`). Tab switches and explicit
camera buttons call `setActiveViewpoint("Viewpoint2")` etc. A `useEffect` watches this state
and drives the viewpoint change by finding the named DOM node and setting its `set_bind`
attribute:

```js
useEffect(() => {
  const tryBind = () => {
    const vp = document.getElementById(activeViewpoint);
    if (vp) {
      vp.setAttribute('set_bind', 'true');   // X3DOM eventIn: activate this viewpoint
      return;
    }
    if (attempts < 30) requestAnimationFrame(tryBind);  // retry until X3DOM initializes it
  };
  tryBind();
}, [activeViewpoint]);
```

`set_bind` is an X3DOM eventIn field — setting it as a DOM attribute is the standard way to
drive X3DOM node behavior imperatively from JavaScript. The `requestAnimationFrame` retry loop
handles the case where the viewpoint node hasn't yet been processed by X3DOM when the effect
runs.

### 9.9 Turn Notifications: Reading G.lastAction

After every progress move the backend sets `G.lastAction` to a summary of what happened during
the turn(s). `Game.jsx` watches `G.gameTime` and `G.lastAction` in a `useEffect` and builds a
user-facing notification array:

```js
useEffect(() => {
  const action = gameState?.G?.lastAction;
  if (!action || action.type !== 'progressTurn') return;
  if (gameDay === lastTurnAlerted) return;  // deduplicate on gameTime

  const messages = [];
  if (action.stoppedEarly)       messages.push('Progress paused after N of M days …');
  if (fishDeaths.length > 0)     messages.push('Fish died: 3× tilapia (ammonia) …');
  if (plantDeaths.length > 0)    messages.push('Plants lost: 5× basil (low nitrate) …');
  if (action.eventTriggered)     messages.push('Upcoming: Pump Failure …');
  if (action.milestoneReached)   messages.push('🏆 Milestone: Profitable …');
  if (action.ecosystemBonus)     messages.push('🌿 Stable Ecosystem unlocked! …');

  setTurnNotification({ messages, turn: gameDay });
}, [gameState?.G?.gameTime, gameState?.G?.lastAction]);
```

The `lastTurnAlerted` guard prevents the same notification from re-firing if React re-renders
the component for an unrelated reason while `gameTime` has not changed. The notification is
displayed as a dismissible banner above the tab panel.

### 9.10 Tutorial System

A five-step onboarding tutorial is implemented entirely in `Game.jsx` using `localStorage` for
persistence. On first visit, `tutorialStep` starts at 1. A `useEffect` advances the step
automatically by watching `G` state values:

```
Step 1 → Step 2: triggered when G.fishFood > 0      (player bought fish food)
Step 2 → Step 3: triggered when G.fish.length > 0   (player added fish)
Step 3 → Step 4: triggered when G.plants.length > 0 (player planted seeds)
Step 4 → Step 5: triggered when G.gameTime >= 1     (player progressed a day)
Step 5 → null:   triggered when G.gameTime >= 5     (tutorial complete)
```

Each step shows a tooltip pointing at the relevant tab button. Once dismissed (or once day 5
is reached), `localStorage.setItem('gnf_tutorial_dismissed', '1')` is called and the tutorial
never shows again. For in-progress games where `gameTime >= 5` on mount, the tutorial is
suppressed immediately.

### 9.11 End-to-End Summary

Putting all layers together, here is what happens from the moment the browser first loads
to a player clicking "Progress Day" and seeing the result:

```
1. Browser loads http://localhost:5173
   Vite serves index.html → main.jsx → React mounts <App />

2. App.jsx mounts
   authAPI.me() → GET /api/auth/me → 200 { user }
   setUser(user) → renders <Game />

3. Game.jsx mounts
   gameAPI.createMatch(setGameState, 'resume')
     → POST /api/games/aquaponics/resume → { matchID: "gnf_…" }
     → GET  /api/games/aquaponics/gnf_… → { G, ctx }
   setGameState({ G, ctx }) → React renders all panels + Renderer

4. X3DViewer mounts
   ensureX3DOMLoaded() → injects x3dom.js CDN script
   x3dom.js loads → X3DOM initializes WebGL canvas inside <x3d>
   X3DOM processes <inline url="MainSceneb.x3d"> → loads static scene geometry
   X3DOM processes <transform> fish/plant nodes → renders entities in WebGL

5. Pick handlers attached
   attachX3domInlinePickHandlers() runs every 100ms × 20 attempts
   Adds onclick="window.__gnfPick('Fish_…')" to each entity transform node

6. Polling starts
   setInterval(1000ms) → GET /api/games/aquaponics/gnf_… every second

7. Player clicks "Progress Day"
   handleProgressTurn() → soundManager.play('progressDay')
   gameAPI.progressTurn()
     → POST /api/games/aquaponics/gnf_…/move { move: "progressTurn" }
     → Express → requireAuth → MatchHandler.makeMove()
     → Deserialize G → runOneTurn(G) → 14 phases → G mutated
     → MongoDB.matches updated → water_readings written
     → Response: { G: { gameTime: 43, money: 1900, … }, ctx }
   gameAPI._fetchAndNotify()
     → GET /api/games/aquaponics/gnf_… (immediate re-fetch)
     → setGameState(newState)

8. React re-renders
   StatsSection:  day 42 → 43,  $1,850 → $1,900
   WaterSection:  ammonia card, nitrate card updated
   Renderer:      plant scale updated (grew by nitrateGrowthMult × ecosystemBonus)
   Game.jsx:      useEffect on G.gameTime fires → reads G.lastAction
                  builds turn notification → setTurnNotification(...)
                  → banner renders above tab panel

9. If event triggered:
   soundManager.play('eventAlert')
   EventsPanel shows amber warning card with pending event name and guidance
```
