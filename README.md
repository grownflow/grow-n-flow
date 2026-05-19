# Grow n' Flow — Aquaponics Simulation Game

A turn-based aquaponics farm management game built with React, Node.js, boardgame.io, and MongoDB. Players balance fish health, plant growth, and water chemistry while managing budgets, responding to random events, and harvesting for profit.

---

## Game Features

### Turn-Based Simulation
- Progress the farm **1 day** or **3 days at a time**. Each day advances fish age and weight, plant growth stages, water chemistry, daily operating costs, and random event rolls.
- Water chemistry history is recorded once per day and drives the live chart in the Water Quality panel.
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
- **Feed Fish** before each turn: food added to the tank is consumed that day; leftovers become sediment and are cleared. Fish not fed for 5 consecutive days die from starvation.
- Feeding is permitted even when ammonia or nitrite is elevated — the game shows a warning but does not block the action. In poor water, the player must decide whether to continue feeding (more ammonia risk) or hold off while fixing chemistry.

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
| Nitrate (NO₃⁻) | 30.0 mg/L | Plant nutrient; safe at normal levels |
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

- **Biofilter efficiency** (0–1.0): Scales the daily ammonia→nitrite and nitrite→nitrate conversion rate (`k = 0.65 × efficiency × circulation`). Reduced to 50% of baseline by the Filter Clog event; requires explicit repair ($50) to restore to 0.8.
- **Circulation efficiency** (0.5–2.0): Governs how quickly dissolved oxygen is replenished each day. Each turn, circulation pulls DO toward the 8 mg/L saturation point at a rate of `25% of deficit × circulationEfficiency`. Stopping circulation (Pump Failure) halts all replenishment. The Low DO event temporarily reduces circulation efficiency; it is **automatically restored** when that event expires.
- **Water level** (0–1000 L): The Water Leak event drains 50 L per turn until repaired. Repairing the leak refills the tank with fresh water, which **dilutes all dissolved pollutants** in proportion to how much new water was added (e.g. repairing at 200 L remaining dilutes ammonia to 20% of its pre-repair value).

---

## Events

Each turn, the game independently rolls against each event's probability. Only **one event can be active at a time**; a new event cannot trigger until the active one resolves (expires or is repaired). Events are evaluated in random order each turn so no single event type is systematically more or less likely than its stated probability. Events are announced with an audio alert and shown in the **Events Panel** with a severity badge, cause description, and turn countdown.

**Repairable events** (Water Leak, Pump Failure, Filter Clog) stay active indefinitely until the player clicks **Repair** in the Events Panel and pays the repair cost. While any of these is active, no other events can trigger, so addressing them promptly reopens the event roll — for better or worse.

**Chemistry and health changes caused by events are persistent.** Ammonia, nitrite, DO, and pH values changed by an event stay at their new levels after the event clears; the player must actively use consumables or partial water changes to restore them. The exception is circulation efficiency reduced by the Low DO event, which is restored automatically when that event expires.

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
- **Effects**: Dissolved Oxygen −2.5 mg/L, Circulation Efficiency −30% from baseline for the duration of the event
- **Cause**: Poor aeration, solids buildup, or overcrowded fish consuming oxygen faster than it is replaced
- **Risk**: Oxygen below 4.0 mg/L stresses all fish; below 2.0 mg/L is lethal within hours. Reduced circulation slows the natural replenishment rate.
- **Recovery**: Circulation efficiency is **automatically restored** to its pre-event value when this event expires after 1 turn. The DO level itself is not restored automatically — use Aeration Stones.
- **Response**: Apply **Aeration Stones** (+2.0 mg/L dissolved oxygen per stone); a Quick Fix button appears automatically in the Water Chemistry panel when oxygen is critical

#### Fish Disease Outbreak
- **Probability**: 2% per turn | **Duration**: 2 turns | **Severity**: High
- **Effects per turn**: Ammonia +1.5 mg/L, Nitrite +0.8 mg/L, Dissolved Oxygen −1.0 mg/L, Fish health −2.5 (affects ~25% of fish each day)
- **Cause**: Poor water quality or pathogen introduction
- **Risk**: Diseased fish produce additional waste, worsening the water chemistry that is already causing the disease — a compounding spiral. Over 2 days, roughly 50% of fish will be affected. Ammonia rises above 1.0 mg/L within the first day, which the game warns about at feeding time.
- **Response**: Apply **Biofilter** for nitrogen; apply **Aeration Stones** for oxygen; continue feeding despite the water quality warning (starvation is worse than the feeding-induced ammonia) and prioritize selling healthy fish before losses mount

#### Plant Disease Outbreak
- **Probability**: 2% per turn | **Duration**: 3 turns | **Severity**: Medium
- **Effects per turn**: Nitrate −3.0 mg/L, Iron −0.8 mg/L, Plant health −2.0 (affects ~30% of plants each day)
- **Cause**: Pathogen introduction or severe nutrient imbalance
- **Risk**: Nitrate and iron depletion weakens all plants simultaneously; the 30% daily fraction means most plants will be hit at least once across 3 turns
- **Response**: Apply **Chelated Iron** to restore iron levels; harvest any mature plants immediately before they die

#### pH Drop
- **Probability**: 4% per turn | **Duration**: 2 turns | **Severity**: Medium
- **Effects per turn**: pH −0.2 (floored at 5.0)
- **Cause**: Natural nitrification consumes carbonate alkalinity over time
- **Risk**: pH below 6.5 stresses plants and slows biofilter bacteria, indirectly allowing ammonia and nitrite to build up. At pH above 7.5, the same ammonia level becomes far more toxic because more is present as free NH₃. Over 2 turns, pH falls 0.4 total — significant if already near 6.5 from daily nitrification drift.
- **Response**: Apply **Buffering Solution (CaCO₃ or K₂CO₃)** to raise pH by 0.2 per application; keep a buffer stock on hand as this event has a 4% chance per turn

#### Water Leak
- **Probability**: 4% per turn | **Duration**: Permanent until repaired | **Severity**: High
- **Effects per turn**: Water level −50 L
- **Cause**: Wear and tear on tank seals
- **Risk**: A 1000 L tank loses 50 L/turn, reaching zero in 20 turns. While the leak is active, no other events can trigger.
- **On repair**: The tank is immediately refilled to full capacity with fresh water. This **dilutes all dissolved pollutants** proportional to the refill fraction — repairing at 200 L remaining reduces ammonia, nitrite, and all other parameters to 20% of their pre-repair values and tops up dissolved oxygen toward saturation. Repair costs $75.
- **Response**: Repair using the **Repair** button in the Events Panel as soon as funds allow. Do not neglect fish feeding while the leak is active — starvation compounds the damage from the leak itself.

#### Pump Failure
- **Probability**: 3% per turn | **Duration**: Permanent until repaired | **Severity**: High
- **Effects**: Circulation stops entirely — natural dissolved oxygen replenishment halts; biofilter conversion rate drops to 15% of normal
- **Cause**: Motor burnout
- **Risk**: Without circulation, DO can no longer recover naturally and only decreases from fish respiration. Nitrification at 15% efficiency means ammonia and nitrite accumulate roughly 7× faster than normal. A fully stocked tank can reach lethal conditions within a handful of turns.
- **Response**: Repair immediately ($100) using the **Repair** button. This is the highest-urgency hardware failure. While waiting to afford repair, apply Aeration Stones each turn and avoid adding more fish or food.

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

## Player Actions

Every action the player can take is listed below. Actions take effect immediately (no turn required) unless noted. Turn-advancing actions trigger the full simulation sequence for each day.

### Advancing Time

| Action | Button | Effect |
|--------|--------|--------|
| Progress 1 Day | Progress 1 Day | Runs one full simulation day: fish feed, chemistry updates, plants age, event rolls |
| Progress 3 Days | Progress 3 Days | Runs three simulation days in sequence; deaths and events from all three days are reported together |

**Important**: food added to the tank is fully consumed (or converted to sediment) each day. If you click Progress 3 Days without feeding, fish eat nothing on days 2 and 3 of that batch. Feed fish immediately before each progress action to ensure they receive food every day.

### Fish Actions

| Action | Where | Notes |
|--------|-------|-------|
| Feed Fish | Fish Panel | Moves food units from inventory into the tank for consumption that day. Shows a warning (but still proceeds) when ammonia or nitrite is above 1.0 mg/L. |
| Buy Fingerlings | Market Panel | Adds juvenile fish to the tank. Cost per fish varies by species. |
| Sell Fish | Fish Panel | Sells fish at market value. Only fish at or above harvest weight count toward full value. |

### Plant Actions

| Action | Where | Notes |
|--------|-------|-------|
| Plant Seed | Plants Panel | Plants one seed of the selected species in an open grow bed slot. Costs seed price from cash. |
| Fill All Slots | Plants Panel | Plants seeds of the selected species in every empty slot at once. |
| Harvest | Plants Panel | Harvests all mature plants into inventory. Plants must reach the mature growth stage first. |
| Sell Harvest | Market Panel | Sells harvested plant inventory at market value per head. |

### Water Chemistry Actions

| Action | Where | Notes |
|--------|-------|-------|
| Apply Consumable | Water Chemistry Panel | Uses one unit of the selected consumable from inventory and applies its chemical effect immediately. |
| Quick Fix – Low DO | Water Chemistry Panel | One-click: buys and applies Aeration Stones when dissolved oxygen is below 5 mg/L. Appears automatically. |
| Quick Fix – High Nitrogen | Water Chemistry Panel | One-click: buys and applies a Biofilter unit when ammonia or nitrite is dangerously elevated. Appears automatically. |
| Partial Water Change | Water Chemistry Panel | Replaces 20% of tank water with fresh water, diluting ammonia, nitrite, nitrate, and other parameters by ~20% and raising dissolved oxygen slightly. Incurs a small water cost. |
| Increase Aeration | Water Chemistry Panel | Adds dissolved oxygen directly and raises circulation efficiency by 0.1. |
| Stop Feeding | Water Chemistry Panel | Removes all food currently in the tank (prevents ammonia spike from uneaten food). |

### Hardware Repair

| Action | Where | Unlocks when |
|--------|-------|-------------|
| Repair | Events Panel | A repairable event is active (Water Leak $75, Pump Failure $100, Filter Clog $50) |

Repair clears the active event immediately, restores the affected hardware parameter, and — for Water Leak — refills the tank with fresh water (diluting chemistry in the process). Repair requires sufficient cash on hand.

### Market / Inventory

| Action | Where | Notes |
|--------|-------|-------|
| Buy Consumables | Market Panel | Purchases Aeration Stones, Biofilter units, Buffering Solutions, or Chelated Iron and adds them to inventory. |
| Buy Fish Food | Market Panel | Adds 10 food units per purchase ($20). Food is drawn from inventory when the player uses Feed Fish. |

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

- **Fish Food**: Buy before each session. Each "Progress 3 Days" click consumes one feeding's worth of tank food on day 1 only; days 2–3 eat nothing unless you feed again. Feed fish immediately before pressing progress to cover all three days, or use Progress 1 Day if you want finer feeding control.
- **Aeration Stones**: Keep at least 5 in reserve at all times. Low DO events, pump failures, and disease outbreaks all demand immediate oxygen correction. The Water Chemistry panel shows a one-click Quick Fix when oxygen is critical.
- **Biofilter units**: Expensive at $120 but the only direct counter to ammonia and nitrite spikes. Keep 1–2 in inventory — the Ammonia Spike (6%/turn) and Nitrite Rise (5%/turn) events are the most common hazards.
- **Buffering solutions**: pH Drop occurs at 4% per turn; over a long game it will strike multiple times. Keep 2–3 units stocked. CaCO₃ is preferred when calcium is also low; K₂CO₃ when potassium is the limiting plant nutrient.
- **Chelated iron**: Consumed slowly by plants and depleted sharply by the Plant Disease event. Apply proactively when iron falls below 1.0 mg/L rather than waiting for a deficiency crisis.
- **Cash reserve**: Keep at least $100 in reserve at all times to cover emergency repairs. Pump Failure ($100) and Water Leak ($75) can arrive without warning and block all other events until repaired.

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
