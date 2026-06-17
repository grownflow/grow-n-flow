# Grow n' Flow — Aquaponics Simulation Game

A turn-based aquaponics farm management game built with React, Node.js, boardgame.io, and MongoDB. Players balance fish health, plant growth, and water chemistry while managing budgets, responding to random events, and harvesting for profit.

---

## Quick Start: 7-Move First-Harvest Path

An average player can achieve a first **plant harvest and fish harvest in exactly 7 moves**. No water-chemistry management is needed: the 7-day grace period blocks all events, and a 5-tilapia system stays within safe water parameters for the entire 6-day run. **Auto-feed is on by default** — fish are fed automatically from inventory before each simulated day, so no separate feed step is required.

| # | Move | Notes |
|---|------|-------|
| 1 | **Buy Fish Food** (1 pack) | $20 → 10 units; auto-feed draws from this each day |
| 2 | **Add Fish** — 5 Tilapia | $10.50 total; each fingerling starts at 10 g |
| 3 | **Plant Seeds** — Basil or Romaine | $0.25–$0.30/seed; fill as many slots as cash allows |
| 4 | **Progress 3 Days** | Auto-feed runs all 3 days; tilapia weight ≈ 305 g by day 3 |
| 5 | **Progress 3 Days** | Auto-feed continues; Basil matures day 5, Romaine matures day 6; tilapia ≈ 600 g |
| 6 | **Harvest All Plants** | Moves all mature plants to inventory for sale |
| 7 | **Sell Fish** | All 5 tilapia ≥ 480 g (80% threshold) → harvestable at full market value |

> A **step-by-step tutorial banner** appears at the bottom of the screen for new players and guides you through moves 1–3.
> You also start with **1 free Biofilter unit** in inventory — apply it from the Water tab to reach 85% efficiency before adding more fish.

**Water chemistry at day 6** (5 tilapia, 80% default biofilter): ammonia ≈ 0 ppm (near zero within capacity), nitrite ≈ 0 ppm, nitrate rising, pH 7.0. No intervention needed.

After day 7 the grace period ends and normal event probabilities apply — see the [Events](#events) section to prepare.

---

## New Player Features

| Feature | Where | What it does |
|---------|-------|-------------|
| **Onboarding tutorial** | Bottom banner | 5-step guide at game start; auto-advances; dismissable; stored in `localStorage` |
| **Auto-feed toggle** | Fish tab | Draws one day's food from inventory before each simulated day (default on) |
| **Color-coded water stats** | Water tab | Green/yellow/red card borders and values for every chemistry parameter |
| **Repair tip notification** | Turn banner | One-time tip pointing to the Events tab the first time a damage event activates |
| **Free starter biofilter** | Inventory | Every new game begins with 1 Biofilter unit; the Market tab explains when to buy more |
| **Quick Repair** | Events tab | Emergency patch at ~50% cost for pump failure, filter clog, and water leak |
| **Success milestones** | Turn banner | Notifications at Established ($1,500), Profitable ($2,500), and Thriving ($5,000) |
| **Stable Ecosystem bonus** | Water tab + turn banner | Streak counter shows progress toward the 10-day goal; bonus announced on unlock with $100 cash reward |
| **Bulk Harvest Bonus** | Turn banner | Harvesting 15+ plants in one action earns a 15% market premium on that batch |
| **Event auto-navigation** | Events tab | When a new technical event is detected, the panel automatically switches to the Events tab and shows a specific "Act now" action guide for that event |
| **Events tab badge** | Tab header | Amber dot = pending event (prepare now); red dot = active event (repair needed) |

---

## Game Features

### Turn-Based Simulation
- Progress the farm **1 day** or **3 days at a time**. Each day advances fish age and weight, plant growth stages, water chemistry, daily operating costs, and random event rolls.
- Water chemistry history is recorded once per day and drives the live chart in the Water Quality panel.
- Game state is persisted to MongoDB so sessions survive page reloads.

### 3D Scene Viewer
- Interactive **X3DOM-powered 3D scene** renders the live farm: fish tank, grow beds, pump/filter.
- Fish and plants are rendered directly from live game state using their entity ID as the React key. When a fish or plant dies it is simply unmounted from the DOM — surviving entity nodes are never touched, so X3DOM never reloads any inline assets.
- Clickable 3D objects feed into the game UI (pick labels mapped from DOM events).
- Viewpoints for the full farm, fish tank, filter, and each individual grow bed.

### Fish Management
Three species are modeled with species-specific tolerances, growth rates, and market values:

| Species    | Harvest weight | Harvest time (game-days) | 80% harvestable | Market value | Fingerling cost |
|------------|---------------|--------------------------|-----------------|--------------|-----------------|
| Tilapia    | 600 g         | 6                        | day 5           | $5.00 / unit | $2.10           |
| Catfish    | 700 g         | 12                       | day 10          | $7.50 / unit | $3.00           |
| Barramundi | 400 g         | 14                       | day 12          | $13.00 / unit | $5.10          |

Harvest times are compressed from real-world months (6–10 months per species) to game-days for playable pacing. Fish are harvestable when weight ≥ 80% of harvest weight. Tilapia is the recommended beginner species: 5 tilapia reach harvest weight within 6 days and support a first harvest on the 7-move path.

- Buy fingerlings, feed fish (consumes fish food inventory), and sell mature fish to market.
- Fish health degrades from poor water quality (ammonia, nitrite, low oxygen), starvation, and disease events.
- Fish not fed for 5 consecutive days die from starvation. **Auto-feed (default on)** draws one day's supply from inventory before every simulated day — for both **Progress Day** and **Progress 3 Days** — as long as the tank is empty and fish food is in stock. Toggle it off from the Fish tab for manual control.
- Feeding is permitted even when ammonia or nitrite is elevated — the game shows a warning but does not block the action. In poor water, the player must decide whether to continue feeding (more ammonia risk) or hold off while fixing chemistry.

### Plant Management
Five species are supported across two categories:

| Species            | Category    | Growth (game-days) | Seed cost | Harvest value |
|--------------------|-------------|---------------------|-----------|---------------|
| Parris Island Romaine | Leafy green | 6               | $0.30     | $3.10 / head  |
| Basil              | Herb        | 5                   | $0.25     | $3.10 / head  |
| Rosemary           | Herb        | 10                  | $0.50     | $4.40 / head  |
| Tomato             | Fruiting    | 14                  | $0.60     | $4.40 / head  |
| Pepper             | Fruiting    | 15                  | $0.55     | $3.10 / head  |

- Plant seeds individually or bulk-buy to fill all open slots in one action.
- Plants progress through **seedling → growing → mature** stages.
- Harvest mature plants to inventory, then sell from the Market panel.
- **Bulk Harvest Bonus**: harvesting 15 or more plants in one action earns a 15% market premium on that batch — reward for scaling your grow beds.
- Each species renders its own 3D GLB asset in the grow bed.

### Water Chemistry Panel
The Water Chemistry panel displays all 9 simulated parameters with two independent live trend charts:

- **Ammonia & Nitrite (ppm)** — auto-scaled to the ammonia/nitrite range; fish and plant death events are overlaid as colored markers with day and count tooltips.
- **Nitrate (ppm)** — scaled independently so the gradual rise of nitrate is visible as the nitrogen cycle matures. A rising trend is healthy; flat or falling nitrate means fish load is too low or plants are consuming nutrients faster than fish produce them.

Quick-fix callout banners appear automatically when oxygen or nitrogen levels cross warning or danger thresholds.

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

Fish waste and uneaten food produce ammonia in the tank each day. The biofilter uses a **capacity-based model** that matches real aquaponics behaviour: the filter removes up to its rated daily capacity each turn, so ammonia and nitrite drain to near-zero as long as fish load is within limits. Only when production exceeds capacity does ammonia start to accumulate.

```
capacity = 2.5 ppm/day × biofilterEfficiency × circulationEfficiency × oxygenFactor

ammonia removed per day = min(ammonia, capacity)
nitrite removed per day = min(nitrite, capacity)
```

**Biofilter maturation** — a new tank starts at **55% efficiency** (1.375 ppm/day capacity), modelling a partially seeded system. Nitrifying bacteria establish over the first 14 game days, rising automatically to **80%** (2.0 ppm/day). Applying the free starter Biofilter unit immediately boosts to 85% and accelerates early cycling. Additional purchased units raise efficiency in 5% steps up to 100% (2.5 ppm/day maximum).

With 5 tilapia fully fed, total daily ammonia production is roughly **0.77 ppm** — within the 1.375 ppm/day starting capacity, so **ammonia stays near zero from day 1**. Nitrate starts at **5 mg/L** and builds steadily as the nitrogen cycle matures. Pump failure reduces throughput to 15% of normal; nitrification is suppressed when dissolved oxygen drops below 5.0 mg/L.

**Ammonia-suppressed growth** — even below the danger threshold, elevated ammonia slows fish growth (`factor = clamp(1 − NH₃ × 0.22, 0.10, 1.0)`). At 0.5 ppm fish grow 11% slower; at 2.0 ppm they grow 56% slower. Clean water directly accelerates harvest timing and revenue — not just fish survival.

**Nitrate-proportional plant growth** — plant maturation speed scales with available nitrate (`clamp(0.85 + (NO₃ − 5)/75 × 0.30, 0.85, 1.15)`). At 5 ppm: 85% speed. At 80 ppm: 115% speed. More fish → more nitrate → faster plants — this is the core virtuous cycle of a productive aquaponics system.

**Stable ecosystem bonus** — maintaining NH₃ < 0.8 ppm, DO > 6.5 mg/L, and pH 6.8–7.2 for 10 consecutive days unlocks +15% fish growth, +10% plant growth, and a one-time **$100 cash reward**. The notification banner announces when this is achieved. A streak counter in the Water tab shows current progress toward the 10-day goal.

### Tracked Water Parameters

| Parameter | Default | Role |
|-----------|---------|------|
| Ammonia (NH₃/NH₄⁺) | 0.0 mg/L | Fish waste byproduct; toxic above species tolerance |
| Nitrite (NO₂⁻) | 0.0 mg/L | Nitrification intermediate; toxic above 1.0 mg/L |
| Nitrate (NO₃⁻) | 5 mg/L | Plant nutrient; builds as fish stock grows; safe at 5–80 mg/L |
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

- **Biofilter efficiency** (0–1.0): Scales the daily nitrification capacity. **Starts at 55%** (1.375 ppm/day); auto-matures to 80% (2.0 ppm/day) over 14 days. Permanently increased by +5% per applied Biofilter unit (max 100% → 2.5 ppm/day). Apply the free starter unit on day 1 to reach 85% immediately. Reduced to 50% of its current value by Filter Clog; requires repair ($50 full / $25 quick) to restore.
- **Circulation efficiency** (0.5–2.0): Governs dissolved oxygen replenishment. Each turn, circulation pulls DO toward 8 mg/L at `25% of deficit × circEff`. Pump Failure halts replenishment entirely (also drops nitrification to 15%); requires repair ($100 full / $50 quick). The Low DO event temporarily reduces circulation; it restores automatically on expiry.
- **Water level** (0–1000 L): Water Leak drains 50 L per turn until repaired. Full repair ($75) refills the tank and dilutes all dissolved pollutants. Quick repair ($37) stops the leak but does not refill.
- **Temperature** (18–32 °C): Drifts daily via an Ornstein-Uhlenbeck process (±0.5 °C/day, reverting toward 25 °C). Purchasing a **Heater/Chiller** unit ($150) tightens the swing to ±0.15 °C and triples the reversion speed. Temperature directly affects fish stress scores and nitrification rate.

---

## Events

Each turn, the game independently rolls against each event's probability. Only **one event can be active at a time**; a new event cannot trigger until the active one resolves (expires or is repaired). Events are evaluated in random order each turn so no single event type is systematically more or less likely than its stated probability. A **7-day grace period** prevents any events from firing while the system is getting established.

Technical events are announced one day in advance as a **Pending Event** — the player sees the warning and can take defensive action before effects apply on the next Progress Day. When a pending event is detected, the UI automatically switches to the **Events tab**, which shows an **"Act now" guide** specific to that event (e.g., "Save $50 for Quick Repair" for pump failure, "Apply Aeration Stones" for low dissolved oxygen). Events are announced with an audio alert and shown in the **Events Panel** with a severity badge, cause description, and turn countdown.

The Events tab header shows a colored dot badge: **amber** for a pending event (prepare now), **red** for an active event (repair needed). Fish-specific events (disease, ammonia spike) only trigger when fish are present; plant-specific events only trigger when plants are growing — they are automatically cancelled if the condition changes between the warning and the activation turn.

**Repairable events** (Water Leak, Pump Failure, Filter Clog) stay active indefinitely until the player clicks **Repair** in the Events Panel and pays the repair cost. While any of these is active, no other events can trigger, so addressing them promptly reopens the event roll — for better or worse.

**Chemistry and health changes caused by events are persistent.** Ammonia, nitrite, DO, and pH values changed by an event stay at their new levels after the event clears; the player must actively use consumables or partial water changes to restore them. The exception is circulation efficiency reduced by the Low DO event, which is restored automatically when that event expires.

### Technical Events

These directly affect water chemistry or hardware. Left unaddressed, most will kill fish or plants.

#### Ammonia Spike
- **Probability**: 4% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Ammonia +1.5 mg/L, Nitrite +0.3 mg/L, Dissolved Oxygen −0.5 mg/L
- **Cause**: Overfeeding, uneaten feed decomposing, or sudden fish die-off adding organic load
- **Risk**: Tilapia tolerate up to 2.0 mg/L; barramundi only 1.0 mg/L — a spike on top of existing background ammonia immediately endangers barramundi
- **Response**: Use **Stop Feeding**, perform a **Partial Water Change**, and apply a **Biofilter** unit (−1.5 mg/L ammonia, −0.8 mg/L nitrite, +5% permanent efficiency)

#### Nitrite Rise
- **Probability**: 3% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Nitrite +0.8 mg/L, Dissolved Oxygen −0.3 mg/L
- **Cause**: Biofilter bacteria disturbed or overwhelmed by heavy waste load
- **Risk**: Nitrite above 1.0 mg/L is stressful for all species; this event can cross that threshold if nitrite is already elevated
- **Response**: Use **Stop Feeding**, perform a **Partial Water Change**, apply a **Biofilter** unit; add **Aeration Stones** if oxygen also drops

#### Low Dissolved Oxygen
- **Probability**: 3% per turn | **Duration**: 1 turn | **Severity**: High
- **Effects**: Dissolved Oxygen −1.5 mg/L, Circulation Efficiency −20% from baseline for the duration of the event
- **Cause**: Poor aeration, solids buildup, or overcrowded fish consuming oxygen faster than it is replaced
- **Risk**: Oxygen below 4.0 mg/L stresses all fish; below 2.0 mg/L is lethal. Reduced circulation slows natural DO replenishment.
- **Recovery**: Circulation efficiency is **automatically restored** to its pre-event value when this event expires after 1 turn. The DO level itself is not restored automatically — use Aeration Stones.
- **Response**: Apply **Aeration Stones** (+2.0 mg/L dissolved oxygen per stone); a Quick Fix button appears automatically in the Water Chemistry panel when oxygen is critical

#### Fish Disease Outbreak
- **Probability**: 1.5% per turn | **Duration**: 2 turns | **Severity**: High
- **Effects per turn**: Ammonia +1.0 mg/L, Nitrite +0.5 mg/L, Dissolved Oxygen −0.5 mg/L, Fish health −1.5 (affects ~20% of fish each day)
- **Cause**: Poor water quality or pathogen introduction
- **Risk**: Diseased fish produce additional waste, compounding the water chemistry decline. Over 2 days, roughly 40% of fish will be individually affected. Ammonia and nitrite rise each day; the game warns about elevated nitrogen at feeding time.
- **Response**: Apply **Biofilter** for nitrogen; apply **Aeration Stones** for oxygen; continue feeding despite water quality warnings (starvation compounds disease damage) and consider selling affected fish to reduce waste load

#### Plant Disease Outbreak
- **Probability**: 1.5% per turn | **Duration**: 3 turns | **Severity**: Medium
- **Effects per turn**: Nitrate −2.0 mg/L, Iron −0.5 mg/L, Plant health −1.2 (affects ~20% of plants each day)
- **Cause**: Pathogen introduction or severe nutrient imbalance
- **Risk**: Nitrate and iron depletion weakens plants; the 20% daily fraction means most plants will be hit at least once across 3 turns
- **Response**: Apply **Chelated Iron** to restore iron levels; harvest any mature plants immediately before they lose health

#### pH Drop
- **Probability**: 2.5% per turn | **Duration**: 2 turns | **Severity**: Medium
- **Effects per turn**: pH −0.2 (floored at 5.0)
- **Cause**: Natural nitrification consumes carbonate alkalinity over time
- **Risk**: pH below 6.5 stresses plants and slows biofilter bacteria, indirectly allowing ammonia and nitrite to build up. At pH above 7.5, the same ammonia level becomes far more toxic because more is present as free NH₃. Over 2 turns, pH falls 0.4 total — significant if already near 6.5 from daily nitrification drift.
- **Response**: Apply **Buffering Solution (CaCO₃ or K₂CO₃)** to raise pH by 0.2 per application; keep buffer stock on hand as this event has a 2.5% chance per turn

#### Water Leak
- **Probability**: 2.0% per turn *(reduced from 2.5%)* | **Duration**: Permanent until repaired | **Severity**: High
- **Effects per turn**: Water level −50 L
- **Cause**: Wear and tear on tank seals
- **Risk**: A 1000 L tank loses 50 L/turn, reaching zero in 20 turns. While the leak is active, no other events can trigger.
- **Repair options**: **Full repair ($75)** — stops the leak and refills the tank with fresh water, diluting all pollutants proportional to the refill fraction. **Quick repair ($37)** — stops the leak immediately but does not refill the tank.
- **Response**: Use Quick Repair if cash is tight; Full Repair when affordable for the chemistry dilution benefit.

#### Pump Failure
- **Probability**: 1.5% per turn *(reduced from 2.0%)* | **Duration**: Permanent until repaired | **Severity**: High
- **Effects**: Circulation stops entirely — natural dissolved oxygen replenishment halts; biofilter conversion rate drops to 15% of normal
- **Cause**: Motor burnout
- **Risk**: Without circulation, DO can no longer recover naturally. Nitrification at 15% efficiency means ammonia accumulates ~7× faster. The highest-urgency hardware failure.
- **Repair options**: **Full repair ($100)** — 100% restoration. **Quick repair ($50)** — restores circulation to 70% immediately; system still impaired but no longer failing.
- **Response**: Quick Repair buys time if $100 is out of reach. Apply Aeration Stones each turn while waiting.

#### Filter Clog
- **Probability**: 2.0% per turn *(reduced from 3.0%)* | **Duration**: Permanent until repaired | **Severity**: Medium
- **Effects**: Biofilter efficiency reduced to 50% of its current value (e.g., 80% → 40%)
- **Cause**: Accumulated solids and uneaten food blocking the filter media
- **Risk**: Halved filtration means ammonia accumulates twice as fast. Especially dangerous during the biofilter maturation period (days 1–14) when efficiency is already building.
- **Repair options**: **Full repair ($50)** — restores efficiency to 100% of pre-clog value. **Quick repair ($25)** — restores to 70% of pre-clog value.
- **Response**: Even the $25 quick repair significantly restores performance — prioritise it over waiting for $50.

### Social Events

#### Market Day Bonus
- **Probability**: 2% per turn | **Duration**: 1 turn | **Severity**: Low
- **Effects**: +$50 cash
- **Cause**: Local festival draws extra buyers to the farmers market
- **Response**: No action needed — spend the windfall on consumables or fingerlings before the next event hits

---

## Player Actions

Every action the player can take is listed below. Actions take effect immediately (no turn required) unless noted. Turn-advancing actions trigger the full simulation sequence for each day.

### Advancing Time

| Action | Button | Effect |
|--------|--------|--------|
| Progress 1 Day | Progress Day | Runs one full simulation day: auto-feeds fish from inventory (if auto-feed on), fish eat, chemistry updates, plants age, event rolls |
| Progress 3 Days | Progress 3 Days | Runs up to 3 days; auto-feeds each day; stops early on critical conditions (fish deaths, danger-level chemistry, system damage event); turns amber ⚠ when a pending event is queued |

**7-Move First-Harvest Path**: An average player can achieve a first plant harvest and first fish harvest in 7 moves. The 7-day grace period blocks all events, so no water-chemistry management is required on this path:

| # | Move | Result |
|---|------|--------|
| 1 | Buy Fish Food (1 pack) | 10 units in inventory |
| 2 | Add Fish — 5 Tilapia | $10.50 total; starting at 10 g each |
| 3 | Plant Seeds — Basil or Romaine | Cheapest and fastest plants |
| 4 | Progress 3 Days | Days 1–3 auto-fed from inventory |
| 5 | Progress 3 Days | Days 4–6 auto-fed; Basil matures day 5, Romaine day 6 |
| 6 | Harvest All Plants | All mature plants moved to inventory |
| 7 | Sell Fish | All 5 tilapia ≥ 480 g → harvestable |

**Auto-feed**: When auto-feed is on (default), fish are automatically fed from inventory before every simulated day — both **Progress Day** and **Progress 3 Days**. Keep Fish Food in stock; the Fish tab shows a warning when inventory is empty.

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

| Action | Where | Cost | Restoration |
|--------|-------|------|-------------|
| Quick Repair | Events Panel | ~50% of full cost | ~70% of function — stops damage, system still impaired |
| Full Repair | Events Panel | Full cost | 100% restoration to pre-event condition |

Both options appear when a repairable event is active. Full Repair also refills the tank (Water Leak) or restores efficiency completely (Filter Clog). Quick Repair is best when cash is tight and the event is compounding damage every turn.

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
| Fish Food | $20 | 10 units | Feeds fish (releases ammonia as byproduct); auto-feed draws from this | Daily feeding stock |
| Aeration Stones | $25 | Pack of 10 | +2.0 mg/L dissolved oxygen per stone | Low DO event, Pump Failure aftermath, Fish Disease |
| Biofilter | $120 | 1 unit | −1.5 mg/L ammonia, −0.8 mg/L nitrite; **permanent +5% biofilter efficiency** (max 100%). Apply early to accelerate the maturation curve. | Ammonia Spike, Nitrite Rise; long-term nitrogen cycle improvement |
| Heater/Chiller | $150 | System upgrade | Tightens daily temperature drift from ±0.5 °C to ±0.15 °C ($0.15/day electricity) | Keeping sensitive species (barramundi) in optimal range; unlocking Stable Ecosystem bonus more reliably |
| Buffering Solution (CaCO₃) | $15 | 1 unit | +0.2 pH, +20 mg/L calcium | pH Drop, calcium deficiency |
| Buffering Solution (K₂CO₃) | $15 | 1 unit | +0.2 pH, +20 mg/L potassium | pH Drop, potassium deficiency |
| Chelated Iron (DTPA 11%) | $12 | 1 unit | +1.0 mg/L iron | Plant Disease, iron deficiency symptoms |

### Stocking Strategy

- **Fish Food**: Auto-feed (default on) draws one day's supply from inventory before every simulated day. Keep at least 10 units in stock. The Fish tab shows a red warning when inventory is empty.
- **Aeration Stones**: Keep at least 5 in reserve. Low DO events, pump failures, and disease outbreaks all demand immediate oxygen correction. The Water Chemistry panel shows a one-click Quick Fix when oxygen is critical.
- **Biofilter units**: You start with **1 free unit** — apply it from the Water tab's Supplements section on day 1 to raise efficiency from 55% to 60% immediately (rather than waiting for natural maturation). Each additional unit ($120) gives an immediate ammonia/nitrite reduction **and** permanently raises efficiency by another 5%, up to 100% (2.5 ppm/day). Keep 1 in reserve at all times; Ammonia Spike (4%/turn) and Nitrite Rise (3%/turn) are the most common hazards.
- **Heater/Chiller** ($150): Consider buying once your system is established (day 14+). It keeps water within the optimal growth range for barramundi (26–29 °C) and makes reaching the Stable Ecosystem bonus (10 consecutive days of optimal water) more achievable.
- **Buffering solutions**: pH Drop occurs at 2.5% per turn. Keep 2–3 units stocked. CaCO₃ is preferred when calcium is also low; K₂CO₃ when potassium is the limiting plant nutrient.
- **Chelated iron**: Consumed slowly by plants and depleted sharply by Plant Disease. Apply proactively when iron falls below 1.0 mg/L.
- **Cash reserve**: Keep at least $50–100 in reserve. Quick Repair options mean you can address events even when short of the full repair cost.

### Gill's AI Advisor
"Gill" is an in-game AI advisor that offers contextual farming tips. Accessible via a popup or inline in the UI.

### Bills & Operating Costs
- Daily electricity costs accumulate per installed equipment.
- A **Bills Panel** shows outstanding costs and deducts them each turn.

### Sound Effects & Mute Toggle
- A mute button in the top bar persists preference across sessions via `localStorage`.
- Sounds play for each of the following player actions:

| Trigger | Audio file |
|---------|-----------|
| Progress Day | `universfield-video-game-bonus-323603.mp3` |
| Progress 3 Days | `ribhavagrawal-achievement-video-game-type-1-230515.mp3` |
| Event alert popup | `floraphonic-8-bit-game-1-186975.mp3` |
| Feed fish | `pwlpl-power-up-game-sound-effect-359227.mp3` |
| Harvest plants or fish | `freesound_community-win-short-38508.mp3` |
| Apply consumable (non-food) | `dammafra-virtual-pet-happy-458154.mp3` |

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
│   ├── scripts/           # run-simulations.js, run-sensitivity-analysis.js
│   └── src/
│       ├── game/
│       │   ├── data/      # Species, equipment, and event definitions
│       │   ├── models/    # Fish, Plant, WaterChemistry domain models
│       │   ├── moves/     # boardgame.io move handlers
│       │   └── utils/     # EventManager, simulation helpers
│       └── simulation/    # Headless bot runner, strategies, analytics
└── FlowFarmFrontend/
    └── src/
        ├── components/    # React UI panels (Game, Fish, Plants, Water, Market, ...)
        ├── config/        # Plant slot positions for 3D scene
        └── services/      # soundManager, gameAPI
```

---

## Simulation & Balance Testing

The backend includes a headless simulation harness for testing game balance without a browser.

```bash
cd backend

# 100-game quick test, all 4 strategies
npm run simulate:quick

# 10,000-game full analysis → simulation-results.json
npm run simulate:full

# Sensitivity analysis: vary each event probability ±10% in 2-point steps
npm run sensitivity           # ~10k games, ~55s
npm run sensitivity:quick     # ~4k games, ~20s
```

**10,000-game results (4 strategies × 2,500 games, 100-day cap) — current calibration:**

| Strategy | Final money | Revenue | Established (≥$1,500) | Profitable (≥$2,500) | Fish deaths | Peak ammonia |
|----------|------------|---------|----------------------|---------------------|-------------|--------------|
| **Conservative** | $1,538 | $1,364 | **66%** | 0% | 0 | 0.41 ppm |
| **Aggressive** | $1,938 | $2,616 | 97% | **37%** | 15.6 | 2.65 ppm |
| **Balanced** | $1,461 | $2,517 | 50% | 0% | 0 | 1.36 ppm |
| **Reactive** | $1,262 | $957 | 6% | 0% | 0 | 0.39 ppm |

Milestones are now routinely achievable after three calibration steps: (1) market prices raised (tilapia $4→$5, barramundi $8.50→$13.00, catfish $6→$7.50; plants +25%); (2) a one-time **$100 Stable Ecosystem reward** when NH₃/DO/pH hold optimal for 10 days; (3) a **15% Bulk Harvest Bonus** when harvesting 15+ plants in one action. Fingerling costs were also reduced (tilapia $2.50→$2.10, catfish $3.50→$3.00, barramundi $6.00→$5.10) to improve restocking margins. Conservative reaches Established in 66% of games; Aggressive reaches Profitable in 37% — a realistic goal for scaled play. The Reactive bot underperforms due to insufficient proactive farming, not a biology issue.
