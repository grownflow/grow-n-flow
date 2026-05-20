# Grow-n-Flow Backend

A boardgame.io-powered Node.js backend for the Grow-n-Flow aquaponics simulation game. This server manages real-time aquaponics system simulation with multiplayer support.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone git@github.com:grownflow/gnf-backend.git
cd gnf-backend
```

2. Install dependencies:
```bash
npm install
```

### Running the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The servers will start at `http://localhost:4000`

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:integration
```

### Manual Testing

#### Health Check
```bash
curl http://localhost:4000
```
Expected response: `Aquaponics backend running.`

#### API Health Check
```bash
curl http://localhost:4000/api
```
Expected response: `{"message":"API is running"}`

#### Game Testing

1. **Create a match:**
```bash
curl -s -X POST http://localhost:4000/api/games/aquaponics/create \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected response: `{"matchID":"abc123"}`

2. **Set match ID (replace with your actual match ID):**
```bash
MATCH_ID=your_match_id_here
```

3. **Test moves:**

Add fish:
```bash
curl -s -X POST http://localhost:4000/api/games/aquaponics/$MATCH_ID/move \
  -H "Content-Type: application/json" \
  -d '{"move":"addFish","args":["tilapia",5],"playerID":"0"}'
```

Add tray:
```bash
curl -s -X POST http://localhost:4000/api/games/aquaponics/$MATCH_ID/move \
  -H "Content-Type: application/json" \
  -d '{"move":"addTray","args":["Lettuce"],"playerID":"0"}'
```

Feed fish:
```bash
curl -s -X POST http://localhost:4000/api/games/aquaponics/$MATCH_ID/move \
  -H "Content-Type: application/json" \
  -d '{"move":"feedFish","args":[0,10],"playerID":"0"}'
```

Progress turn:
```bash
curl -s -X POST http://localhost:4000/api/games/aquaponics/$MATCH_ID/move \
  -H "Content-Type: application/json" \
  -d '{"move":"progressTurn","args":[],"playerID":"0"}'
```

4. **Check game state:**
```bash
curl -s http://localhost:4000/api/games/aquaponics/$MATCH_ID
```
Returns: `{"G":{...game state...},"ctx":{...context...}}`

## 🏗 Architecture

### Dual Server Setup

- **Express API Server** (Port 4000) - REST endpoints for game moves, user management, leaderboards, game history

### Core Components

- **Aquaponics Simulation Engine** - Core logic for water cycles, nutrients, and plant growth
- **Game Models** - Fish, Plants, Sensors, Lights, Grow Beds, and AquaponicsSystem
- **Move System** - Player actions organized by category (fish, plants, economy, system)
- **Constants** - Fish species and plant varieties

## 🛠 API Integration

### Express API Server (Port 4000)
- **POST** `/api/games/aquaponics/create` - Create new match
- **GET** `/api/games/aquaponics/:matchID` - Get current game state
- **POST** `/api/games/aquaponics/:matchID/move` - Execute moves
- **GET** `/api/` - API health check
- **GET** `/` - Server health check

### Boardgame.io Server (Port 8000)
- Future multiplayer synchronization
- Currently not used for moves (uses Express endpoints above)

## 🧪 Continuous Integration

This project uses GitHub Actions for:
- **Automated Testing** - Runs on Node.js 18.x, 20.x, and 22.x
- **Test Coverage** - Reports coverage to Codecov
- **Build Validation** - Ensures clean builds
- **Deployment Pipeline** - Ready for production deployment

## 🌱 Aquaponics Simulation Model

Grow-n-Flow simulates a recirculating aquaponics system where fish waste feeds plants and plants clean the water for fish. Every game day advances the full nitrogen cycle, water chemistry, fish growth, and plant growth simultaneously.

---

### Nitrogen Cycle

Fish excrete ammonia, which a biofilter colony converts first to nitrite (toxic) and then to nitrate (plant fertilizer). Each day the simulation applies:

```
k = 0.80 × biofilterEfficiency × circulationEfficiency × oxygenFactor
ammonia converted to nitrite = ammonia × k
nitrite converted to nitrate  = nitrite  × k
```

- Default biofilter efficiency: **80%** (k ≈ 0.64/day)
- Maximum biofilter efficiency: **100%** (k = 0.80/day)
- Nitrification is suppressed when dissolved oxygen drops below 5.0 mg/L
- Nitrification slightly acidifies the water (−0.01 pH per mg/L converted)

**Ammonia production per fish per day** combines feeding waste and passive metabolic excretion:

```
ammoniaDelta = portion × (0.25 + 0.15 × ammoniaRate) + ammoniaRate × 1.0
```

`ammoniaRate` is the species-specific coefficient (tilapia 0.10, barramundi 0.08, catfish 0.11). With 5 tilapia fully fed (each consuming 0.2 food units/day), this produces roughly **0.77 ppm/day** total (5 × [0.2 × (0.25 + 0.015) + 0.10]). At default biofilter efficiency (k ≈ 0.64/day), ammonia reaches a steady state of ~0.43 ppm — safely below the 1.0 mg/L alert threshold. Nitrate starts at **5 mg/L** (the game's initial default) and builds as the nitrogen cycle matures (net of plant uptake).

**Safe target ranges:**

| Parameter        | Safe Range        | Danger Threshold |
|------------------|-------------------|------------------|
| Ammonia          | < 1.0 mg/L        | ≥ 2.0 mg/L       |
| Nitrite          | < 0.5 mg/L        | ≥ 1.0 mg/L       |
| Nitrate          | 5–80 mg/L         | < 1.0 mg/L       |
| pH               | 6.5–7.5           | < 6.5 or > 7.5   |
| Dissolved Oxygen | ≥ 5.0 mg/L        | < 4.0 mg/L       |
| Iron             | ≥ 1.0 mg/L        | < 1.0 mg/L       |

---

### Fish Species

Harvest times are compressed from real-world months to game-days for pacing. Tilapia is the beginner species: 5 fish reach 80% harvest weight (≥ 480 g) by day 6, enabling a first harvest on the standard 7-move path (see Player Actions below).

| Species    | Fingerling Cost | Harvest Weight | Game Harvest Time | 80% Harvestable | Market Value | Ammonia Rate (ppm/day passive) |
|------------|-----------------|----------------|-------------------|-----------------|--------------|--------------------------------|
| Tilapia    | $2.50           | 600 g          | 6 days            | day 5           | $4.00/unit   | 0.10                           |
| Catfish    | $3.50           | 700 g          | 12 days           | day 10          | $6.00/unit   | 0.11                           |
| Barramundi | $6.00           | 400 g          | 14 days           | day 12          | $8.50/unit   | 0.08                           |

Fish are harvestable when weight ≥ 80% of harvest weight. Market value scales with weight-in-pounds × species price × health factor.

Fish health (0–10 scale) is reduced by poor water quality (high ammonia/nitrite, low oxygen, wrong temperature or pH). Fish die at health = 0. Starvation applies escalating penalties from day 2 without food and kills unconditionally at day 5.

---

### Plant Species

Plants consume nitrate each day (provided lights are on) and are harvested when fully mature.

| Species               | Category     | Grow Time (game days) | Seed Cost | Harvest Value |
|-----------------------|--------------|-----------------------|-----------|---------------|
| Parris Island Romaine | Leafy green  | 6                     | $0.30     | $2.50/head    |
| Basil                 | Herb         | 5                     | $0.25     | $2.50/head    |
| Rosemary              | Herb         | 10                    | $0.50     | $3.50/head    |
| Tomato                | Fruiting     | 14                    | $0.60     | $3.50/head    |
| Pepper                | Fruiting     | 15                    | $0.55     | $2.50/head    |

Plant health (0–10) recovers +0.15/day under good conditions and declines when nitrate, iron, pH, or lighting is out of range. Dead plants (health = 0) are removed from the system and the 3D scene; surviving plants are never affected.

---

### Events

A **7-day grace period** prevents any events from firing while the system is establishing. After day 7, each event rolls its probability independently each free day (one active event at a time).

**Technical events** are announced one day in advance as a **Pending Event**. The player sees the warning and can take defensive action (buy supplies, do a water change, save for repair) before effects apply on the next Progress Day.

#### Social Events

| Event            | Probability | Effect           | Duration |
|------------------|-------------|------------------|----------|
| Market Day Bonus | 2%/day      | +$50             | 1 day    |

#### Technical Events — Water Quality

| Event                  | Probability | Key Effects                                    | Severity | Duration |
|------------------------|-------------|------------------------------------------------|----------|----------|
| Sudden Ammonia Spike   | 4%/day      | ammonia +1.5, nitrite +0.3, DO −0.5            | High     | 1 day    |
| Nitrite Rise           | 3%/day      | nitrite +0.8, DO −0.3                          | High     | 1 day    |
| Low Dissolved Oxygen   | 3%/day      | DO −1.5, circulation −20%                      | High     | 1 day    |
| pH Drop                | 2.5%/day    | pH −0.2/day                                    | Medium   | 2 days   |
| Fish Disease Outbreak  | 1.5%/day    | ammonia +1.0, nitrite +0.5, fish health −1.5 (20% of fish/day) | High | 2 days |
| Plant Disease Outbreak | 1.5%/day    | nitrate −2.0, iron −0.5, plant health −1.2 (20% of plants/day) | Medium | 3 days |

#### Technical Events — System Damage (require repair)

| Event        | Probability | Effect                         | Severity | Repair Cost |
|--------------|-------------|--------------------------------|----------|-------------|
| Water Leak   | 2.5%/day    | −50 L water/day, permanent     | High     | $75         |
| Pump Failure | 2%/day      | circulation stopped, permanent | High     | $100        |
| Filter Clog  | 3%/day      | biofilter efficiency −50%, permanent | Medium | $50    |

System damage events persist until the player uses the **Repair System** action from the Events tab. The biofilter efficiency lost to a Filter Clog is restored to its pre-event value on repair.

---

### Inventory and Consumables

Items are purchased from the Market and stored in inventory. Consumables are applied from the Water Chemistry panel.

| Item                               | Cost  | Effect when applied                                              |
|------------------------------------|-------|------------------------------------------------------------------|
| Fish Food (10 units)               | $20   | Adds food to tank; fish consume daily based on species need      |
| Biofilter                          | $120  | Instant: ammonia −1.5 mg/L, nitrite −0.8 mg/L. Permanent: biofilter efficiency +5% (max 100%) |
| Buffering Solution — Ca Carbonate  | $15   | pH +0.2, calcium +20 mg/L                                       |
| Buffering Solution — K Carbonate   | $15   | pH +0.2, potassium +20 mg/L                                     |
| Chelated Iron (DTPA 11%)           | $12   | Iron +1.0 mg/L                                                   |
| Aeration Stones (pack of 10)       | $25   | Dissolved oxygen +2.0 mg/L per stone applied                    |

---

### Player Actions

| Action                  | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| Progress Day            | Advances simulation by 1 day; runs the full nitrogen/growth/event cycle     |
| Progress 3 Days         | Advances 3 days; auto-feeds fish from inventory each day the tank is empty  |
| Stop Feeding            | Removes all food from tank; eliminates feeding-based ammonia immediately    |
| Partial Water Change    | Dilutes water chemistry; primary tool for reducing ammonia and nitrite       |
| Increase Aeration       | Boosts dissolved oxygen                                                     |
| Apply Consumable        | Uses one unit from inventory to adjust water chemistry or biofilter         |
| Repair System           | Pays repair cost to clear active system-damage event (Leak/Pump/Filter Clog)|
| Buy Fish / Plant Seeds  | Adds fingerlings or seeds from the Market                                   |
| Harvest Plants / Fish   | Sells mature plants or market-weight fish for cash                          |
| Sell Fish               | Sells individual fish at current market value                               |

---

### Water Chemistry Trend Charts

The Water Chemistry panel shows two independent trend charts over game history:

- **Ammonia & Nitrite (ppm)** — scaled to 0–max(ammonia, nitrite); includes death event markers (fish and plants). Use this to spot nitrogen spikes and evaluate whether your biofilter is keeping pace.
- **Nitrate (ppm)** — scaled independently so gradual nitrate buildup is visible. A steadily rising nitrate line is a sign of a healthy, productive nitrogen cycle; a flat or falling line indicates insufficient fish load or heavy plant uptake stripping nutrients faster than fish produce them.

Both charts fetch from the `water_readings` MongoDB collection, which records one entry per game day.

---

### First-Harvest Path (7 Required Moves)

An average player can achieve a first plant harvest **and** first fish harvest in exactly 7 actions. No water-chemistry management is required: the 7-day grace period blocks all events, and a 5-tilapia system stays within safe water parameters for the full 6 days.

| # | Move | Notes |
|---|------|-------|
| 1 | Buy Fish Food (1 pack) | $20 → 10 units in inventory |
| 2 | Add Fish — 5 Tilapia | $12.50; starting weight 10 g each |
| 3 | Plant Seeds — Basil or Romaine | $0.25–$0.30/seed; any quantity affordable |
| 4 | Progress 3 Days | Auto-feeds from inventory all 3 days; day 3 weight ≈ 305 g |
| 5 | Progress 3 Days | Auto-feeds all 3 days; Basil mature day 5, Romaine day 6; tilapia ≈ 600 g |
| 6 | Harvest All Plants | Sells all mature plants from inventory |
| 7 | Sell Fish | All 5 tilapia ≥ 480 g (80% threshold) → harvestable |

**Water chemistry at day 6 (5 tilapia, 80% biofilter):** ammonia ≈ 1.0 ppm (alert but safe), nitrite < 0.3 ppm, pH 7.0. No intervention needed. After day 7 the grace period ends and normal event probabilities apply.

---

### System Alerts

The simulation generates actionable alerts each turn based on current water chemistry, fish load, and biofilter state. Alerts distinguish between load problems (too many fish for the filter) and equipment problems (low efficiency), directing players toward the correct intervention rather than always recommending the same purchase.

---

Built for educational and entertainment purposes to teach aquaponics concepts through interactive gameplay.
