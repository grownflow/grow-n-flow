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

### Bot Simulation Testing

The backend includes a headless simulation harness that runs the full game engine with AI bot players — no browser or database required. Use it to measure game balance, test mechanics, and validate changes before playing.

#### npm script shortcuts

```bash
# 20 games × 4 strategies × 60 days — fast sanity check (~2s)
npm run simulate:quick

# 100 games × 4 strategies × 100 days → simulation-results.json (~2s)
npm run simulate:full

# 100,000 games (25k per strategy) → 4 output files: JSON aggregate + 3 CSVs (~12min)
node scripts/run-100k.js

# Full sensitivity analysis: sweeps each event probability ±10 pp in 2-point steps
# 9 events × 11 steps × 100 games = 9,900 games → sensitivity-results.json + .csv (~15s)
npm run sensitivity

# Quick sensitivity: 40 games/config instead of 100, noisier but faster (~6s)
npm run sensitivity:quick
```

100k outputs (all in `backend/`):
- `simulation-results-100k.json` — aggregate stats per strategy (compact)
- `simulation-results-100k.csv` — aggregate stats (4 rows)
- `simulation-games-100k.csv` — per-game summary (100k rows)
- `simulation-snapshots-100k.csv` — 10-day snapshots per game (~1M rows)

#### Custom simulation runs

```bash
node scripts/run-simulations.js [options]

Options:
  -c, --count <n>          Games to simulate per strategy (default: 10)
  -s, --strategies <list>  Comma-separated strategies (default: balanced)
                           Available: conservative, aggressive, balanced, reactive
  -t, --max-turns <n>      Maximum days per game (default: 365)
  -o, --output <file>      Save full results to JSON file
  -v, --verbose            Print per-game detail

Examples:
  # 2,500 games per strategy, 100-day cap, all strategies, save output
  node scripts/run-simulations.js -c 2500 -s conservative,aggressive,balanced,reactive -t 100 -o results.json

  # 50 games, conservative only, verbose
  node scripts/run-simulations.js -c 50 -s conservative -t 100 -v
```

#### Custom sensitivity analysis

```bash
node scripts/run-sensitivity-analysis.js [options]

Options:
  -n, --games <n>      Games per configuration (default: 100)
  -t, --max-turns <n>  Days per game (default: 100)
  -o, --output <stem>  Output file stem without extension (default: sensitivity-results)
  -q, --quick          40 games/config for a fast exploratory run
  -h, --help           Show help

Outputs: <stem>.json (full per-config data) + <stem>.csv (one row per event × delta)
```

#### Bot strategies

| Strategy | Behaviour | Typical outcome |
|----------|-----------|-----------------|
| `balanced` | 8 tilapia + 3 barramundi, 30 plants, mixed species, proactive water management | **Target: 1st** — high revenue + healthy-pop billing bonus ($150/game) + ecosystem bonus; ~0 deaths |
| `conservative` | 5 tilapia, 20 plants, $200 cash buffer, immediate repairs, proactive biofilter | **Target: 2nd** — school tour ($400/2%/day) + ammonia-gated event reduction + healthy-pop bonus ($75/game); 0 deaths |
| `aggressive` | 15 fish (barramundi + tilapia), 60 Basil plants, $50 buffer, reactive chemistry | **Target: 3rd** — highest gross revenue but ~14 deaths/game; ammonia health drain + 3× filter clog rate + no billing bonuses |
| `reactive` | 5 tilapia max, 10 plants, delays purchases, repairs only when critical | **Target: 4th** — clean water but slow stocking limits revenue below $1,000; healthy-pop bonus ($75/game) insufficient to compete |

#### Simulation files

| File | Purpose |
|------|---------|
| `src/simulation/SimulationRunner.js` | Core harness — runs games, collects stats |
| `src/simulation/BotStrategies.js` | Per-strategy decision logic (what to buy, when to harvest) |
| `src/simulation/Bot.js` | Base bot class — water chemistry responses, auto-repair |
| `src/simulation/GameAnalytics.js` | Aggregates per-game results into summary statistics |
| `scripts/run-simulations.js` | CLI entry point for batch runs |
| `scripts/run-sensitivity-analysis.js` | CLI entry point for sensitivity sweeps |

---

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

Fish excrete ammonia, which a biofilter colony converts first to nitrite (toxic) and then to nitrate (plant fertilizer). The simulation uses a **capacity-based model** that matches real aquaponics behaviour: a mature biofilter removes up to its full daily capacity each turn, so ammonia and nitrite stay near zero as long as fish load is within limits. Only when production exceeds capacity does ammonia accumulate.

```
capacity = BASE_BIOFILTER_CAPACITY × biofilterEfficiency × circulationEfficiency × oxygenFactor

ammonia removed = min(ammonia, capacity)
nitrite removed = min(nitrite, capacity)
```

- `BASE_BIOFILTER_CAPACITY` = **2.5 ppm/day** at 100% efficiency
- **Starting efficiency: 55%** → capacity **1.375 ppm/day** (new tank, partially seeded)
- Matures automatically to **80%** over 14 days → capacity **2.0 ppm/day**
- Maximum efficiency: **100%** (applied Biofilter units) → capacity **2.5 ppm/day**
- Pump failure reduces throughput to 15% of normal (bacteria need circulation)
- Nitrification is suppressed when dissolved oxygen drops below 5.0 mg/L
- Nitrification slightly acidifies the water (−0.01 pH per mg/L converted)

**Biofilter maturation** — `runOneTurn` adds `(0.80 − 0.55) / 14 ≈ 0.018` to efficiency each day for the first 14 days, simulating the establishment of *Nitrosomonas* and *Nitrobacter* colonies. This models the "cycling" period every real aquaponics system must complete before stocking heavily.

**Ammonia production per fish per day** combines feeding waste and passive metabolic excretion:

```
ammoniaDelta = portion × (0.25 + 0.15 × ammoniaRate) + ammoniaRate × 1.0
```

`ammoniaRate`: tilapia 0.10, barramundi 0.08, catfish 0.11. With 5 tilapia (0.77 ppm/day total load) the system stays well within the 1.375 ppm/day starting capacity. Nitrate starts at **5 mg/L** and builds as the nitrogen cycle matures.

**Ammonia-suppressed fish growth** — sublethal ammonia reduces feed conversion efficiency even before fish show health stress:

```
ammoniaGrowthFactor = clamp(1 − ammonia × 0.22, 0.10, 1.0)
```

At 0.5 ppm: 89% growth rate. At 2.0 ppm: 56% growth rate. At ≥ 4.1 ppm: clamped to 10%. This is the primary financial incentive to maintain clean water — slower-growing fish delay harvests and reduce revenue.

**Nitrate-proportional plant growth** — plant maturation speed scales with available nitrate:

```
nitrateGrowthMult = clamp(0.85 + (nitrate − 5) / 75 × 0.30, 0.85, 1.15)
```

At 5 ppm nitrate: 85% growth rate. At 80 ppm: 115% growth rate. This links fish biomass directly to plant revenue, rewarding the right stocking density rather than either under- or over-stocking.

**Stable ecosystem bonus** — maintaining ammonia < 1.2 ppm, DO > 6.0 mg/L, and pH 6.5–7.5 for 10 consecutive days unlocks a permanent +15% fish growth / +10% plant growth multiplier (`G.systemModifiers.ecosystemBonus = true`) and pays a one-time **$100 cash reward** (`G.stableEcosystemRewarded = true` prevents double-payment). Thresholds are set at "healthy" (not pristine) levels so that both Conservative and Balanced strategies can earn the bonus. Resets on any single day outside the thresholds. Progress is stored in `G.stableEcosystemDays` and displayed as a streak counter in the Water tab.

**Healthy-population billing bonus** — at each 30-day billing cycle, the farm earns **$5 per fish** when tank ammonia is below 1.5 ppm. Balanced (10 fish, ~1.3 ppm) earns $50/cycle ($150/game); Conservative and Reactive (5 fish, clean water) earn $25/cycle ($75/game); Aggressive (15 fish, avg 2.4 ppm) earns nothing.

**Ammonia toxicity drain** — above 1.5 ppm, each excess ppm reduces fish health by 0.2/day and plant health by 0.15/day. Applied after the standard stress model each turn. Aggressive (avg 2.4 ppm) bears the full cost; Conservative and Reactive (avg < 0.4 ppm) are unaffected.

**Fish-count water cost** — `$0.08 × fishCount` per day is added to `calculateDailyUtilityCosts`. Aggressive (15 fish) pays ~$1.20/day extra; Conservative (5 fish) ~$0.40/day.

**Biofilter load scaling** — `filterClog` probability is multiplied by `min(3.0, 1.0 + (fishCount − 5) × 0.2)`. At 5 fish: 1×; at 10 fish: 2×; at 15 fish: 3×. Each clog halves biofilter efficiency, cascading into higher ammonia and more health drain.

**Safe target ranges:**

| Parameter        | Safe Range        | Danger Threshold |
|------------------|-------------------|------------------|
| Ammonia          | < 1.0 mg/L        | ≥ 2.0 mg/L       |
| Nitrite          | < 0.5 mg/L        | ≥ 1.0 mg/L       |
| Nitrate          | 5–80 mg/L         | < 3.0 mg/L (plant health damage starts) |
| pH               | 6.5–7.5           | < 6.5 or > 7.5   |
| Dissolved Oxygen | ≥ 5.0 mg/L        | < 4.0 mg/L       |
| Iron             | ≥ 1.0 mg/L        | < 1.0 mg/L       |

---

### Fish Species

Harvest times are compressed from real-world months to game-days for pacing. Tilapia is the beginner species: 5 fish reach 80% harvest weight (≥ 480 g) by day 6, enabling a first harvest on the standard 7-move path (see Player Actions below).

| Species    | Fingerling Cost | Harvest Weight | Game Harvest Time | 80% Harvestable | Market Value | Ammonia Rate (ppm/day passive) |
|------------|-----------------|----------------|-------------------|-----------------|--------------|--------------------------------|
| Tilapia    | $2.10           | 600 g          | 6 days            | day 5           | $5.00/unit   | 0.10                           |
| Catfish    | $3.00           | 700 g          | 12 days           | day 10          | $7.50/unit   | 0.11                           |
| Barramundi | $5.10           | 400 g          | 14 days           | day 12          | $13.00/unit  | 0.08                           |

Fish are harvestable when weight ≥ 80% of harvest weight. Market value scales with weight-in-pounds × species price × health factor.

Fish health (0–10 scale) is reduced by poor water quality (high ammonia/nitrite, low oxygen, wrong temperature or pH). Fish die at health = 0. Starvation applies escalating penalties from day 2 without food and kills unconditionally at day 5.

---

### Plant Species

Plants consume nitrate each day (provided lights are on) and are harvested when fully mature.

| Species               | Category     | Grow Time (game days) | Seed Cost | Harvest Value |
|-----------------------|--------------|-----------------------|-----------|---------------|
| Parris Island Romaine | Leafy green  | 6                     | $0.30     | $3.10/head    |
| Basil                 | Herb         | 5                     | $0.25     | $3.10/head    |
| Rosemary              | Herb         | 10                    | $0.50     | $4.40/head    |
| Tomato                | Fruiting     | 14                    | $0.60     | $4.40/head    |
| Pepper                | Fruiting     | 15                    | $0.55     | $3.10/head    |

Plant health (0–10) recovers +0.15/day under good conditions and declines when nitrate, iron, pH, or lighting is out of range. Dead plants (health = 0) are removed from the system and the 3D scene; surviving plants are never affected.

**Nitrate deficiency** — below 3 ppm nitrate, plants take active health damage each day: `penalty = (3.0 − nitrate) × 0.4`. At 0 ppm this is −1.2/day; a fully healthy plant (10) dies in ~8 days. The alert system fires at < 3 ppm (damage active) and < 5 ppm (early warning). Progress 3 Days stops early when nitrate < 3 ppm with plants in the tank. To raise nitrate: add more fish (more ammonia → more nitrification) or harvest mature plants to reduce uptake.

**Bulk Harvest Bonus** — when `harvestAllMaturePlants` collects 15 or more plants in a single call, all harvested `unitPrice` values are multiplied by 1.15 before being stored in inventory. This rewards players who scale their grow beds and batch their harvests rather than picking a few plants at a time.

---

### Events

A **7-day grace period** prevents any events from firing while the system is establishing. After day 7, each event rolls its probability independently each free day (one active event at a time).

**Technical events** are announced one day in advance as a **Pending Event**. The player sees the warning and can take defensive action (buy supplies, do a water change, save for repair) before effects apply on the next Progress Day. Fish-specific events (`requiresFish: true`) and plant-specific events (`requiresPlants: true`) are automatically cancelled if the relevant entities are gone by the time the event would activate — preventing disease alerts on empty systems.

**Ammonia-gated events** use an `ammoniaThreshold` field: `EventManager.checkForRandomEvent` skips the event entirely when `ammonia ≥ threshold`. Used by School Tour to reward clean-water management.

**Ammonia-contingent mechanical probabilities** — pump failure, filter clog, and water leak fire at 50% of their base probability when tank ammonia < 0.5 ppm. This rewards proactive water management: Conservative and Reactive strategies (avg ~0.40 ppm) face roughly half as many hardware failures as Aggressive (avg 2.53 ppm).

#### Social Events

| Event            | Probability | Gate              | Effect | Duration |
|------------------|-------------|-------------------|--------|----------|
| Market Day Bonus | 2%/day      | None              | +$50   | 1 day    |
| School Tour      | 2.0%/day    | ammonia < 0.5 ppm | +$400  | 1 day    |

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
| Water Leak   | 2.0%/day    | −50 L water/day, permanent     | High     | $75 (quick: $37)  |
| Pump Failure | 1.5%/day    | circulation stopped, permanent | High     | $100 (quick: $50) |
| Filter Clog  | 2.0%/day    | biofilter efficiency −50%, permanent | Medium | $50 (quick: $25) |

**Quick Repair** stops the damage for ~50% of the full cost but leaves the system at ~70% of normal function (pump at 70% circulation; filter at 70% of pre-clog efficiency; leak stopped but tank not refilled). Use when cash is tight and the event is actively compounding.

System damage events persist until the player uses the **Repair System** action from the Events tab. The biofilter efficiency lost to a Filter Clog is restored to its pre-event value on repair.

---

### Inventory and Consumables

Items are purchased from the Market and stored in inventory. Consumables are applied from the Water Chemistry panel.

**Starting inventory:** Every new game begins with `{ biofilter: 1 }` pre-loaded in `G.equipment`. This gives new players a concrete reason to visit the Water tab and learn how to apply a biofilter unit before they need to buy one.

| Item                               | Cost  | Starting qty | Effect when applied                                              |
|------------------------------------|-------|-------------|------------------------------------------------------------------|
| Fish Food (10 units)               | $20   | 0           | Adds food to tank; auto-feed draws from this each day when on   |
| Biofilter                          | $120  | **1 (free)**| Instant: ammonia −1.5 mg/L, nitrite −0.8 mg/L. Permanent: biofilter efficiency +5% (max 100%). Apply early to accelerate maturation beyond the natural 55→80% curve. |
| Heater/Chiller                     | $150  | 0           | Permanent system upgrade. Reduces daily temperature drift from ±0.5 °C to ±0.15 °C ($0.15/day electricity). |
| Buffering Solution — Ca Carbonate  | $15   | 0           | pH +0.2, calcium +20 mg/L                                       |
| Buffering Solution — K Carbonate   | $15   | 0           | pH +0.2, potassium +20 mg/L                                     |
| Chelated Iron (DTPA 11%)           | $12   | 0           | Iron +1.0 mg/L                                                   |
| Aeration Stones (pack of 10)       | $25   | 0           | Dissolved oxygen +2.0 mg/L per stone applied                    |

---

### Player Actions

| Action                  | Description                                                                 |
|-------------------------|-----------------------------------------------------------------------------|
| Progress Day            | Advances simulation by 1 day; runs the full nitrogen/growth/event cycle. Auto-feeds fish from inventory if auto-feed is enabled. |
| Progress 3 Days         | Advances up to 3 days with early-exit on critical conditions (fish deaths, plant deaths, ammonia ≥ 2.0, nitrite ≥ 1.0, DO ≤ 4.0, nitrate < 3.0 with plants, system damage events); auto-feeds each day when auto-feed is on |
| Set Auto-Feed           | Toggles `G.autoFeed` (default `true`). When on, draws one day's food from inventory before each simulated day if the tank is empty |
| Stop Feeding            | Removes all food from tank; eliminates feeding-based ammonia immediately    |
| Partial Water Change    | Dilutes water chemistry; primary tool for reducing ammonia and nitrite       |
| Increase Aeration       | Boosts dissolved oxygen                                                     |
| Apply Consumable        | Uses one unit from inventory to adjust water chemistry or biofilter         |
| Quick Repair System     | Emergency patch: ~50% cost, ~70% restoration. Stops damage but leaves lasting impairment. |
| Repair System           | Full repair: pays full cost to restore system to 100% pre-event condition            |
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

An average player can achieve a first plant harvest **and** first fish harvest in exactly 7 actions. No water-chemistry management is required: the 7-day grace period blocks all events, and a 5-tilapia system stays within safe water parameters for the full 6 days. Auto-feed (`G.autoFeed = true` by default) handles feeding on every Progress — no separate feed step is needed.

| # | Move | Notes |
|---|------|-------|
| 1 | Buy Fish Food (1 pack) | $20 → 10 units; auto-feed draws from this each day |
| 2 | Add Fish — 5 Tilapia | $10.50; starting weight 10 g each |
| 3 | Plant Seeds — Basil or Romaine | $0.25–$0.30/seed; any quantity affordable |
| 4 | Progress 3 Days | Auto-feed runs all 3 days; day 3 weight ≈ 305 g |
| 5 | Progress 3 Days | Auto-feed continues; Basil mature day 5, Romaine day 6; tilapia ≈ 600 g |
| 6 | Harvest All Plants | Sells all mature plants from inventory |
| 7 | Sell Fish | All 5 tilapia ≥ 480 g (80% threshold) → harvestable |

**Water chemistry at day 6 (5 tilapia, 80% biofilter):** ammonia ≈ 1.0 ppm (alert but safe), nitrite < 0.3 ppm, pH 7.0. No intervention needed. After day 7 the grace period ends and normal event probabilities apply.

---

### Initial Game State

Every new match starts with the following defaults so players can begin playing immediately without being blocked by missing prerequisites:

| Field | Default | Reason |
|-------|---------|--------|
| `G.money` | $1000 | Enough to buy fish, seeds, and supplies before first harvest |
| `G.autoFeed` | `true` | Auto-feed on by default; toggle with `setAutoFeed` move |
| `G.fishFood` | 0 | Players must buy food; auto-feed draws from this |
| `G.equipment.biofilter` | 1 | Free starter unit so players can learn the nitrogen cycle hands-on |
| `G.aquaponicsSystem.tank.biofilterEfficiency` | 0.8 (80%) | Established baseline; applying the starter unit raises it to 85% |
| `G.aquaponicsSystem.tank.water.nitrate` | 5 mg/L | Small baseline so plants have initial nutrients |

---

### System Alerts

The simulation generates actionable alerts each turn based on current water chemistry, fish load, and biofilter state. Alerts distinguish between load problems (too many fish for the filter) and equipment problems (low efficiency), directing players toward the correct intervention rather than always recommending the same purchase.

---

---

### Temperature Model

Water temperature follows a mean-reverting random walk (Ornstein-Uhlenbeck process). Each day:

```
ΔT = noise × driftAmp − (T − 25°C) × reversionSpeed
```

| Condition | Drift amplitude | Reversion speed | Effective range |
|-----------|----------------|----------------|-----------------|
| No heater/chiller | ±0.5 °C/day | 0.05 | ~20–30 °C |
| With heater/chiller | ±0.15 °C/day | 0.15 | ~23–27 °C |

Temperature affects fish stress via `EnvironmentalStress.calculateOverallStress`. Fish outside their optimal range grow more slowly and accumulate health damage. Tilapia optimal: 25–30 °C; barramundi optimal: 26–29 °C.

---

### Success Milestones

The game tracks progressive financial milestones stored in `G.highestMilestoneMoney`. `runOneTurn` checks against these thresholds each day and sets `lastAction.milestoneReached` when a new one is crossed.

| Milestone | Threshold | Represents |
|-----------|-----------|------------|
| Established | $1,500 | Consistent revenue covers operating costs |
| Profitable | $2,500 | Capital investment starting to pay back |
| Thriving | $5,000 | Expert balance of all system parameters |

---

### Simulation Results — 100,000 Games (n = 25,000 per strategy)

Eight calibration rounds have been applied. Target ranking achieved as of Round 8 (2026-06-24).

**Target strategy ranking (final money): Balanced > Conservative > Aggressive > Reactive** ✓

#### Round 8 results — current (2026-06-24, n = 25,000 per strategy)

| Rank | Strategy | Final money | Revenue | Repair costs | Fish deaths | Plant deaths | Peak NH₃ | Profitable |
|------|----------|------------|---------|-------------|-------------|-------------|---------|---------|
| 1 | **Balanced** | **$2,382** | $2,540 | $173 | 0 | 0 | 1.31 ppm | 37% |
| 2 | **Conservative** | $2,334 | $1,374 | $133 | 0 | 4.5 | 0.36 ppm | 36% |
| 3 | **Aggressive** | $2,287 | $2,472 | $250 | 14.8 | 455.7 | 2.54 ppm | 52% |
| 4 | **Reactive** | $1,999 | $968 | $117 | 0 | 0.3 | 0.35 ppm | 15% |

Milestone breakdown: Balanced (none 1%, established 62%, profitable 37%, thriving 0%) · Conservative (1/64/36/0) · Aggressive (1/46/52/1) · Reactive (16/70/15/0)

#### 100k pre-sustainability baseline (2026-06-23)

| Strategy | Final money | Revenue | Fish deaths | Peak ammonia | Profitable |
|----------|------------|---------|-------------|--------------|------------|
| **Aggressive** | **$2,044** | $2,634 | ~14 | 2.53 ppm | **41%** |
| **Conservative** | $1,580 | $1,362 | 0 | 0.40 ppm | 0% |
| **Balanced** | $1,548 | $2,517 | 0 | 1.35 ppm | 0% |
| **Reactive** | $1,308 | $956 | 0 | 0.39 ppm | 0% |

#### Calibration history

| Round | Change | Key result |
|-------|--------|-----------|
| v1 (no biology fixes) | — | Aggressive dominated ($1,742) |
| vFinal (7 biology fixes) | Ammonia suppression, nitrate growth, events rebalanced | Aggressive collapsed to $369 |
| +price bump | All species +~25% | Conservative Established 1% → 41% |
| +bonus mechanics | Stable ecosystem $100 + 15% Bulk Harvest Bonus | Aggressive Profitable 15% → 37% |
| Round 5 | Zero-mortality $150, ammonia-gated events, School Tour ($250/1.5%), wider ecosystem threshold | Balanced/Conservative/Reactive pulled up; Aggressive still #1 |
| Round 6 | Removed zero-mortality; School Tour $400/2.0%; ammonia health drain (>1.5 ppm); fish-count water cost ($0.08/fish/day) | Aggressive $2,389 still #1 by $123 |
| Round 7 | Biofilter load factor (filterClog ×3 at 15 fish) | Aggressive $2,155 · Balanced $2,217 · Conservative $2,255 — Conservative briefly #1 |
| Round 8 | Healthy-population billing bonus ($5/fish/cycle, ammonia < 1.5 ppm) | **Balanced $2,382 · Conservative $2,334 · Aggressive $2,287 · Reactive $1,999 — target ranking achieved** |

Run `node scripts/run-100k.js` from this directory to regenerate (~10 min). See [Bot Simulation Testing](#bot-simulation-testing) for the full command reference.

---

Built for educational and entertainment purposes to teach aquaponics concepts through interactive gameplay.
