# Grow n' Flow — Aquaponics Simulation Game

A turn-based aquaponics farm management game built with React, Node.js, boardgame.io, and MongoDB. Players balance fish health, plant growth, and water chemistry while managing budgets, responding to random events, and harvesting for profit.

---

## Game Features

### Turn-Based Simulation
- Progress the farm **3 days at a time**. Each turn advances fish age and weight, plant growth stages, water chemistry, daily operating costs, and random event rolls.
- Game state is persisted to MongoDB so sessions survive page reloads.

### 3D Scene Viewer
- Interactive **X3DOM-powered 3D scene** renders the live farm: fish tank, grow beds, pump/filter.
- Fish and plants appear and disappear in the scene as they are added or die — using `render="false"` to avoid reloading all 3D assets when a single entity changes.
- Clickable 3D objects feed into the game UI (pick labels mapped from DOM events).
- Viewpoints for the full farm, fish tank, filter, and each individual grow bed.

### Fish Management
Three species are modeled with species-specific tolerances, growth rates, and market values:

| Species    | Harvest weight | Harvest time | Market value | Fingerling cost |
|------------|---------------|--------------|--------------|-----------------|
| Tilapia    | 600 g         | 210 days     | $4.00 / unit | $2.50           |
| Barramundi | 400 g         | 285 days     | $8.50 / unit | $6.00           |
| Catfish    | 700 g         | 240 days     | $6.00 / unit | $3.50           |

- Buy fingerlings, feed fish (consumes fish food inventory), and sell mature fish to market.
- Fish health degrades from poor water quality (ammonia, nitrite, low oxygen), starvation, and disease events.
- Daily feeding is automated from tank nutrient dynamics; manual feeding tops up fish food stock.

### Plant Management
Five species are supported across two categories:

| Species            | Category    | Growth cycle | Seed cost | Harvest value |
|--------------------|-------------|--------------|-----------|---------------|
| Parris Island Romaine | Leafy green | 6 weeks   | $0.30     | $2.50 / head  |
| Basil              | Herb        | 5 weeks      | $0.25     | $2.50 / head  |
| Rosemary           | Herb        | 10 weeks     | $0.50     | $3.50 / head  |
| Tomato             | Fruiting    | 14 weeks     | $0.60     | $3.50 / head  |
| Pepper             | Fruiting    | 15 weeks     | $0.55     | $2.50 / head  |

- Plant seeds individually or bulk-buy to fill all open slots in one action.
- Plants progress through **seedling → growing → mature** stages.
- Harvest mature plants to inventory, then sell from the Market panel.
- Each species renders its own 3D GLB asset in the grow bed.

### Water Chemistry Panel
The Water Chemistry panel displays all 9 simulated parameters with a live time-series chart. Fish death and plant death events are overlaid as colored markers with day and count tooltips. Quick-fix callout banners appear automatically when oxygen or nitrogen levels cross warning or danger thresholds.

---

## Aquaponics Simulation Model

The core simulation models the nitrogen cycle and water chemistry of a recirculating aquaponics system. Every turn the following processes run in sequence:

### The Nitrogen Cycle

```
Fish eat food → excrete ammonia (NH₃/NH₄⁺)
    ↓ biofilter bacteria (Nitrosomonas)
Nitrite (NO₂⁻)  ← toxic intermediate
    ↓ biofilter bacteria (Nitrobacter)
Nitrate (NO₃⁻)  ← plant nutrient; absorbed by roots
```

Fish waste and uneaten food accumulate as sediment in the tank. Each day the biofilter converts a fraction of ammonia to nitrite and nitrite to nitrate, with the conversion rate scaling linearly with **biofilter efficiency** (default 0.8, max 1.0). Plants then draw down nitrate based on their species nutrient requirements. If plants cannot absorb nitrate fast enough — or if the biofilter is damaged — ammonia and nitrite accumulate to toxic levels.

### Tracked Water Parameters

| Parameter | Default | Role |
|-----------|---------|------|
| Ammonia (NH₃/NH₄⁺) | 0.0 mg/L | Fish waste byproduct; toxic above species tolerance |
| Nitrite (NO₂⁻) | 0.0 mg/L | Nitrification intermediate; toxic above 1.0 mg/L |
| Nitrate (NO₃⁻) | 10.0 mg/L | Plant nutrient; safe at normal levels |
| pH | 7.0 | Affects ammonia toxicity; optimal 6.8–7.2 |
| Dissolved Oxygen | 8.0 mg/L | Required by fish and aerobic biofilter bacteria |
| Temperature | 25 °C | Affects species stress and ammonia toxicity |
| Calcium | 60 mg/L | Plant macronutrient; raised by CaCO₃ buffer |
| Potassium | 40 mg/L | Plant macronutrient; raised by K₂CO₃ buffer |
| Iron | 2.0 mg/L | Plant micronutrient; raised by chelated iron supplement |

### Fish Stress Model

Each fish experiences four independent stress factors every day. They are averaged into an **overall stress score** (0.0 = none, 1.0 = lethal):

| Stressor | Lethal threshold | Notes |
|----------|-----------------|-------|
| Temperature | Outside species range | Ramps linearly from optimal band to min/max |
| Ammonia | Species-specific max (1.0–2.0 mg/L) | pH and temperature amplify toxicity: higher pH → more free NH₃; warmer water → faster uptake |
| Nitrite | 1.0 mg/L (all species) | Stress begins above 0.2 mg/L |
| Dissolved Oxygen | Below species minimum (4.0 mg/L) | Stress begins below 5.0 mg/L; lethal at ≤ 2.0 mg/L |

Fish health is reduced each day proportional to overall stress. A fish with health 0 dies and is removed from the game state and 3D scene. Species vary in sensitivity:

| Species | Ammonia max | Nitrite max | O₂ min | Temp optimal |
|---------|------------|------------|--------|--------------|
| Tilapia | 2.0 mg/L | 1.0 mg/L | 4.0 mg/L | 25–30 °C |
| Barramundi | 1.0 mg/L | 1.0 mg/L | 4.0 mg/L | 26–29 °C |
| Catfish | 1.5 mg/L | 1.0 mg/L | 4.0 mg/L | 24–29 °C |

**Barramundi is the most sensitive** species and will die fastest in poor water. Tilapia is the most forgiving.

### System Hardware Parameters

- **Biofilter efficiency** (0–1.0): Scales the daily ammonia→nitrite and nitrite→nitrate conversion. Reduced by the Filter Clog event (fixed at 50% of pre-event baseline until repaired). Restored to 0.8 on repair.
- **Circulation efficiency** (0.5–2.0): Affects dissolved oxygen distribution. Reduced by the Low DO and Pump Failure events. Stopping circulation halts oxygen replenishment entirely.
- **Water level** (0–1000 L): Tank capacity. The Water Leak event drains 50 L per turn until repaired. If water level drops too low, fish are stressed.

---

## Events

Each turn, the game rolls independently against the probability of every defined event. Only one event can be active at a time. Events are announced with an audio alert and shown in the **Events Panel** with a severity badge, cause description, and turn countdown.

### Technical Events

These directly affect water chemistry or hardware. Left unaddressed, most will kill fish or plants.

#### Ammonia Spike
- **Probability**: 6% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Ammonia +2.5 mg/L, Nitrite +0.5 mg/L, Dissolved Oxygen −0.8 mg/L
- **Cause**: Overfeeding, uneaten feed decomposing, or sudden fish die-off adding organic load
- **Risk**: Tilapia survive up to 2.0 mg/L; barramundi only 1.0 mg/L — this event immediately endangers barramundi
- **Response**: Apply a **Biofilter** unit to cut ammonia by 1.5 mg/L and nitrite by 0.8 mg/L; reduce feeding temporarily

#### Nitrite Rise
- **Probability**: 5% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Nitrite +1.2 mg/L, Dissolved Oxygen −0.5 mg/L
- **Cause**: Biofilter bacteria disturbed or overwhelmed by heavy waste load
- **Risk**: Nitrite above 1.0 mg/L is lethal for all three species; this event alone can cross that threshold
- **Response**: Apply a **Biofilter** unit to lower nitrite by 0.8 mg/L; add **Aeration Stones** if oxygen drops further

#### Low Dissolved Oxygen
- **Probability**: 5% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Dissolved Oxygen −2.5 mg/L, Circulation Efficiency −30% from baseline
- **Cause**: Poor aeration, solids buildup, or overcrowded fish consuming oxygen faster than it is replaced
- **Risk**: Oxygen below 4.0 mg/L stresses all fish; below 2.0 mg/L is lethal within hours. Reduced circulation makes recovery slower.
- **Response**: Apply **Aeration Stones** (+2.0 mg/L dissolved oxygen per stone); a Quick Fix button appears automatically in the Water Chemistry panel when oxygen is critical

#### Fish Disease Outbreak
- **Probability**: 2% per turn | **Duration**: 2 turns | **Severity**: High
- **Effects per turn**: Ammonia +1.5 mg/L, Nitrite +0.8 mg/L, Dissolved Oxygen −1.0 mg/L, Fish health −2.5 (affects ~25% of fish each day)
- **Cause**: Poor water quality or pathogen introduction
- **Risk**: Diseased fish produce additional waste, worsening the water chemistry that is already causing the disease — a compounding spiral. Over 2 days, roughly 50% of fish will be affected.
- **Response**: Apply **Biofilter** for nitrogen; apply **Aeration Stones** for oxygen; prioritize selling healthy fish before losses mount

#### Plant Disease Outbreak
- **Probability**: 2% per turn | **Duration**: 3 turns | **Severity**: Medium
- **Effects per turn**: Nitrate −3.0 mg/L, Iron −0.8 mg/L, Plant health −2.0 (affects ~30% of plants each day)
- **Cause**: Pathogen introduction or severe nutrient imbalance
- **Risk**: Nitrate and iron depletion weakens all plants simultaneously; the 30% daily fraction means most plants will be hit at least once across 3 turns
- **Response**: Apply **Chelated Iron** to restore iron levels; harvest any mature plants immediately before they die

#### pH Drop
- **Probability**: 4% per turn | **Duration**: 2 turns | **Severity**: Medium
- **Effects per turn**: pH −0.2
- **Cause**: Natural nitrification consumes carbonate alkalinity over time
- **Risk**: pH below 6.5 starts to inhibit biofilter bacteria, indirectly allowing ammonia and nitrite to build up. At pH above 7.5, the same ammonia level becomes far more toxic because more is present as free NH₃.
- **Response**: Apply **Buffering Solution (CaCO₃ or K₂CO₃)** to raise pH by 0.2 per application; keep a buffer stock on hand as this event is relatively frequent

#### Water Leak
- **Probability**: 4% per turn | **Duration**: Permanent until repaired | **Severity**: High
- **Effects per turn**: Water level −50 L
- **Cause**: Wear and tear on tank seals
- **Risk**: A 1000 L tank losing 50 L/turn will reach critically low levels within 10–15 turns, concentrating all dissolved wastes and stressing fish
- **Response**: Repair immediately using the **Repair** button in the Events Panel ($75). Stock cash reserves; this event can arrive at any time.

#### Pump Failure
- **Probability**: 3% per turn | **Duration**: Permanent until repaired | **Severity**: High
- **Effects**: Circulation stops entirely — dissolved oxygen no longer replenishes each turn
- **Cause**: Motor burnout
- **Risk**: Without circulation, dissolved oxygen drops steadily every turn. All fish will die within a few turns of zero circulation in a fully stocked tank.
- **Response**: Repair immediately ($100). This is the highest-urgency hardware failure.

#### Filter Clog
- **Probability**: 5% per turn | **Duration**: Permanent until repaired | **Severity**: Medium
- **Effects**: Biofilter efficiency reduced to 50% of its pre-event value (e.g., 0.8 → 0.4)
- **Cause**: Accumulated solids and uneaten food blocking the filter media
- **Risk**: Halved filtration means ammonia and nitrite accumulate roughly twice as fast. Serious in a heavily stocked tank; manageable if the tank is lightly stocked or plants are consuming nitrate quickly.
- **Response**: Repair ($50) to restore efficiency. This is the lowest-cost hardware repair and should be done promptly before nitrogen levels climb.

### Social Events

#### Market Day Bonus
- **Probability**: 10% per turn | **Duration**: 1 turn | **Severity**: Low
- **Effects**: +$50 cash
- **Cause**: Local festival draws extra buyers to the farmers market
- **Response**: No action needed — spend the windfall on consumables or fingerlings before the next event hits

---

## Market & Inventory

The **Market panel** sells fingerlings (by species), fish food, and water treatment consumables. Purchased items go into inventory. Consumables are applied from the **Water Chemistry panel** or via quick-fix buttons that appear when a parameter is in the danger zone.

### Consumables Reference

| Item | Cost | Quantity | Effect when applied | Best used for |
|------|------|----------|---------------------|---------------|
| Fish Food | $20 | 10 units | Feeds fish (releases ammonia as byproduct) | Daily feeding stock |
| Aeration Stones | $25 | Pack of 10 | +2.0 mg/L dissolved oxygen per stone | Low DO event, Pump Failure aftermath, Fish Disease |
| Biofilter | $120 | 1 unit | −1.5 mg/L ammonia, −0.8 mg/L nitrite | Ammonia Spike, Nitrite Rise, Fish Disease |
| Buffering Solution (CaCO₃) | $15 | 1 unit | +0.2 pH, +20 mg/L calcium | pH Drop, calcium deficiency |
| Buffering Solution (K₂CO₃) | $15 | 1 unit | +0.2 pH, +20 mg/L potassium | pH Drop, potassium deficiency |
| Chelated Iron (DTPA 11%) | $12 | 1 unit | +1.0 mg/L iron | Plant Disease, iron deficiency symptoms |

### Stocking Strategy

- **Aeration Stones**: Buy in packs of 10 and keep at least 5 in reserve. Low DO events and pump failures both demand immediate response. The Water Chemistry panel shows a one-click Quick Fix button when oxygen is critical.
- **Biofilter units**: Expensive at $120 but the only direct counter to ammonia and nitrite spikes. Keep 1–2 in inventory — the Ammonia Spike (6%/turn) and Nitrite Rise (5%/turn) events are the most frequently occurring hazards.
- **Buffering solutions**: pH Drop has a 4% chance per turn; over a long game it will occur multiple times. Keep 2–3 of either buffer variant stocked. CaCO₃ is preferred if calcium is also falling; K₂CO₃ if potassium is the limiting plant nutrient.
- **Chelated iron**: Iron is slowly consumed by plants and further depleted by the Plant Disease event. Apply proactively when iron falls below 1.0 mg/L rather than waiting for a deficiency crisis.

### Gill's AI Advisor
"Gill" is an in-game AI advisor that offers contextual farming tips. Accessible via a popup or inline in the UI.

### Bills & Operating Costs
- Daily electricity costs accumulate per installed equipment.
- A **Bills Panel** shows outstanding costs and deducts them each turn.

### Sound Effects & Mute Toggle
- Event alert, feed fish, harvest, and consumable-apply sounds play at the appropriate moments.
- A mute button in the top bar persists preference across sessions via `localStorage`.

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18, Vite, X3DOM (3D rendering) |
| Game logic | boardgame.io (turn-based state machine) |
| Backend   | Node.js, Express, Koa (boardgame.io server) |
| Database  | MongoDB (game state persistence) |
| Container | Docker Compose (frontend + backend + MongoDB) |

---

## Running the Game

### Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/) installed and running.

```bash
docker-compose up --build
```

| Service  | URL |
|----------|-----|
| Game UI  | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| MongoDB  | localhost:27017 |

### Manual (local development)

**1. Start MongoDB**

```bash
# Docker one-liner:
docker run -d -p 27017:27017 --name grow-mongo mongo

# Or install MongoDB Community Server locally (default port 27017)
```

**2. Start the backend**

```bash
cd backend
npm install
npm start
```

**3. Start the frontend**

```bash
cd FlowFarmFrontend
npm install
npm run dev
```

Open http://localhost:5173 to play.

---

## Project Structure

```
grow-n-flow-main/
├── backend/
│   └── src/game/
│       ├── data/          # Species, equipment, and event definitions
│       ├── models/        # Fish, Plant, WaterChemistry domain models
│       ├── moves/         # boardgame.io move handlers
│       └── utils/         # EventManager, simulation helpers
└── FlowFarmFrontend/
    └── src/
        ├── components/    # React UI panels (Game, Fish, Plants, Water, Market, ...)
        ├── config/        # Plant slot positions for 3D scene
        └── services/      # soundManager, gameAPI
```
