# Grow-n-Flow — Simulation Model

*Written: 2026-06-26*

This document describes the causal structure of the game: how player decisions affect water
chemistry, how chemistry affects biological entities, how entities drive economics, and how
events interrupt and stress the system. The goal is to explain not just what each parameter
does, but how every lever connects to every outcome.

---

## 1. The Gameplay Loop

Every day in Grow-n-Flow follows the same cycle. The player makes zero or more decisions
— buying fish, planting seeds, applying supplements, repairing damage — and then advances
time. The game engine runs one day of simulation, chemistry changes, organisms respond to
chemistry, money flows in and out, events may fire, and the new state is delivered back as
feedback. The player reads that feedback and makes the next round of decisions.

```
╔═══════════════════════════════════════════════════════════════════╗
║                     DAILY GAMEPLAY LOOP                          ║
╚═══════════════════════════════════════════════════════════════════╝

   ┌──────────────────────────────────────────────────────────┐
   │                   PLAYER DECISIONS                       │
   │  Buy fish · Buy seeds · Buy equipment · Feed · Repair   │
   └───────────────────────┬──────────────────────────────────┘
                           │  (zero or more moves before advancing)
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │               ADVANCE TIME (Progress Day)               │
   │                                                          │
   │  1. Event promotion  (pending → active)                 │
   │  2. Active event effects applied                        │
   │  3. Biofilter matures  (+0.018%/day up to day 14)      │
   │  4. Temperature drifts (Ornstein-Uhlenbeck toward 25°C) │
   │  5. Fish feeding → ammonia generated → fish grow        │
   │  6. Nitrogen cycle: ammonia → nitrite → nitrate         │
   │  7. Dissolved oxygen replenishment                      │
   │  8. Plants take up nitrate                              │
   │  9. Stable ecosystem streak check                       │
   │  10. Plant growth and health update                     │
   │  11. Ammonia toxicity applied to fish and plants        │
   │  12. Utility costs accrue; billing every 30 days        │
   │  13. Milestone check                                    │
   │  14. New event detection roll                           │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │                 FEEDBACK TO PLAYER                       │
   │  Water readings · Fish health/weight · Plant stages     │
   │  Cash balance · Turn notification · Event alerts        │
   │  System alerts · Trend charts                           │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           └──────────► back to PLAYER DECISIONS
```

The loop runs until day 100 (time limit), until the player reaches the Thriving milestone
($5,000), or until bankruptcy (money reaches $0 and no revenue is possible). Within the 100-day
window the player must build a sustainable nitrogen cycle, grow enough biomass to generate
revenue, manage cash through the billing cycle, and survive random events.

---

## 2. The Nitrogen Cycle: The Central Mechanic

The aquaponics nitrogen cycle is the biological engine that links fish to plants. Fish eat food,
excrete ammonia, bacteria in the biofilter convert ammonia through nitrite to nitrate, and plants
absorb nitrate as their primary nutrient. This cycle is the fundamental constraint that makes
every other decision in the game consequential.

```
FOOD
  │
  │  Player buys fish food ($20/pack = 10 units)
  │  Fish food loaded into tank (feedFish move)
  ▼
FISH FEEDING
  │  Each fish receives a portion of available food proportional to body weight.
  │  fish.weight += portion × baseGrowthRate × stressMultiplier
  ▼
AMMONIA PRODUCTION
  │  ammonia += (portion × 0.25) + (fishAmmoniaRate × 1.0)  per fish per day
  │  Tilapia ammonia rate: 0.1 ppm/day baseline
  │  Barramundi: 0.08 ppm/day  (cleaner but higher food cost)
  │  Catfish: 0.11 ppm/day
  │
  │  ⚠ Ammonia is toxic: > 1.5 ppm damages fish and plants every day
  │  ⚠ Ammonia > 0.5 ppm doubles the probability of mechanical failures
  ▼
NITRIFICATION (BIOFILTER)
  │  capacity = 2.5 ppm/day × biofilterEfficiency
  │  ammonia removed → nitrite  = min(ammonia, capacity)
  │  nitrite removed → nitrate  = min(nitrite, capacity)
  │  water.nitrate += nitriteToNitrate
  │  water.pH -= 0.01 × (ammoniaConverted + nitriteConverted)  (acid-forming)
  │
  │  Biofilter efficiency:
  │    Day 1:    55% → capacity 1.375 ppm/day
  │    Day 14+:  80% → capacity 2.0 ppm/day  (bacterial colony established)
  │    +5% per biofilter unit applied (max 100% → capacity 2.5 ppm/day)
  │
  │  Blocked by: pumpFailure (circulation stops → nitrification near zero)
  │  Reduced by: filterClog (efficiency × 0.5) or pumpFailure (no flow)
  ▼
NITRATE ACCUMULATION
  │  Nitrate builds in the water column. Without plants it rises indefinitely.
  │  Nitrate is non-toxic at normal aquaponics concentrations (< 150 ppm).
  │  Nitrate is the primary plant nutrient — too low causes health damage.
  ▼
PLANT NITRATE UPTAKE
  │  Each day (when grow lights are on):
  │    Seedling: −0.02 ppm per plant
  │    Growing:  −0.04 ppm per plant
  │    Mature:   −0.06 ppm per plant
  │  water.nitrate = max(0, nitrate − totalUptake)
  │
  │  ⚠ When nitrate < 3 ppm: plant.health -= (3 − nitrate) × 0.4 per day
  │  ⚠ A plant at full health (10) with nitrate at 0 dies in 25 days
  │  ⚠ Nitrate < 5 ppm: plants grow at 85% rate (floor)
  ▼
BACK TO FISH (closed loop)
  Plants remove nitrate → keeps water clean for fish
  Fish produce waste → feeds plants
  The system is balanced when nitrate production ≈ nitrate uptake
```

### 2.1 Nitrogen Balance Equation

On any given day the net change in tank nitrate is:

```
Δnitrate = nitrification_output − plant_uptake

nitrification_output ≈ min(ammonia, 2.5 × biofilterEfficiency)
                     ≈ min(fishCount × ammoniaRate, capacity)

plant_uptake = Σ(uptakeRate[growthStage]) for each plant

Balanced state: Δnitrate ≈ 0   (nitrate stays in the 5–50 ppm sweet spot)
Oversupply:     Δnitrate > 0   (nitrate rises; add more plants)
Undersupply:    Δnitrate < 0   (nitrate falls toward 0; add more fish or reduce plants)
```

This balance is the core design tension. Too few fish: nitrate falls, plants starve. Too many
fish without enough biofilter capacity: ammonia accumulates, fish and plants take toxicity
damage. The sweet spot requires the player to understand and manage both sides of the cycle
simultaneously.

---

## 3. Player Choices and Their Consequences

Every purchasable item or action modifies specific variables in the game state. The table below
maps each move to its immediate effect, its downstream consequence in the nitrogen cycle, and
its economic cost-benefit.

### 3.1 Fish

**Buying fingerlings** (`addFish`)

Each fingerling starts at 10 g and begins eating and producing waste immediately. Adding fish
increases daily ammonia load. Whether this is beneficial or harmful depends on how much
biofilter capacity and nitrate demand currently exists.

| Species | Cost | Harvest Weight | Time | Market Value | NH₃ Rate |
|---------|------|---------------|------|-------------|----------|
| Tilapia | $2.10/fish | 600 g | 6 days | $5.00/fish | 0.10 ppm/day |
| Barramundi | $5.10/fish | 400 g | 14 days | $13.00/fish | 0.08 ppm/day |
| Catfish | $3.00/fish | 700 g | 12 days | $7.50/fish | 0.11 ppm/day |

Tilapia is the short-cycle workhorse: cheap, fast, lower value per fish. Barramundi is the
premium bet: twice the market value, longer grow time, narrower temperature tolerance (18–29°C),
and barramundi die if ammonia exceeds 1.0 ppm (vs. 2.0 ppm for tilapia). Adding barramundi is
a commitment to excellent water quality.

**Feeding fish** (`feedFish`, or `setAutoFeed`)

Food loaded into the tank is distributed to fish proportionally by body weight. Uneaten food
decomposes and adds ammonia. Starving fish (5+ consecutive days without food) lose health at
an accelerating rate. Auto-feed draws inventory fish food each day automatically; without it,
the player must manually load food every turn. The Aggressive bot relies on auto-feed because
it manages 15 fish across many turns.

**Selling fish** (`sellFish`)

A fish that has reached 80% of its harvest weight is eligible for sale at full market value.
Selling removes the fish from the tank, immediately reducing daily ammonia production and
nitrate demand. Timing of harvest is a cash flow decision: sell early for quick cash, or wait
for maximum weight — fish grow faster with more food, so the optimal harvest window is narrow
once a fish exceeds 70% of harvest weight.

### 3.2 Plants

**Planting seeds** (`plantSeedsBulk`)

Seeds planted immediately occupy a grow-bed slot and begin consuming nitrate as they germinate.
The player spends cash on seeds and commits a portion of available nitrate budget.

| Species | Seed Cost | Grow Time | Harvest Value | Nitrate Stage Uptake |
|---------|-----------|-----------|---------------|---------------------|
| Basil | $0.25 | 5 days | $3.10/head | 0.02/0.04/0.06 ppm/plant/day |
| Romaine | $0.30 | 6 days | $3.10/head | 0.02/0.04/0.06 ppm/plant/day |
| Rosemary | $0.50 | 10 days | $4.40/head | 0.02/0.04/0.06 ppm/plant/day |
| Tomato | $0.60 | 14 days | $4.40/head | 0.02/0.04/0.06 ppm/plant/day |
| Pepper | $0.55 | 15 days | $3.10/head | 0.02/0.04/0.06 ppm/plant/day |

All species use the same three-stage uptake model. The growth-stage sequence — seedling (0–33%
of grow time), growing (33–67%), mature (67–100%) — means total nitrate consumed over a full
crop cycle is approximately:

```
total uptake = growTime × (0.33×0.02 + 0.33×0.04 + 0.34×0.06)  ≈ 0.04 ppm/day average
```

For 20 plants over 6 days (Romaine), total uptake ≈ 4.8 ppm. If the tank has only 5 ppm
nitrate on planting day and fish production adds 2 ppm/day, the system runs to depletion by
day 2. The player must pre-charge the system with sufficient nitrate before planting at scale.

**Harvesting** (`harvestAllMaturePlants`)

Harvesting moves mature plants to inventory; selling converts them to cash. A bulk harvest of
15 or more plants in a single action earns a 15% price premium on the entire batch. Delay
beyond maximum age (2× grow time) causes plants to start declining in health — the player is
rewarded for precise timing.

**Sell produce** (`sellProducts`)

Cash is received at market rate per head. Because plant cycles are short (5–15 days), the
plant revenue stream is high-frequency and reliable. Fish cycles are longer but each sale is a
larger lump sum.

### 3.3 Water Chemistry

**Apply biofilter** (`applyConsumable` with `biofilter`)

Immediate effect: −1.5 ppm ammonia, −0.8 ppm nitrite. Permanent effect: +5% biofilter
efficiency (max 100%). At cost $120, the break-even requires roughly 8 turns of avoided
ammonia-driven damage or event suppression. The efficiency boost compounds with maturation:
a biofilter applied on day 5 (55% base) yields 60% immediately and retains that 60% floor
even after the 14-day maturation cap is reached.

**Aeration stones** (`applyConsumable` with `aerationStones`)

Each stone applied: +2.0 ppm dissolved oxygen. The pack costs $25 and contains 10 stones.
Dissolved oxygen below 5 ppm triggers a warning; below 3 ppm the system is in crisis (fish
cannot survive long). Aeration stones are the primary response to the `lowDissolvedOxygen`
event and to overcrowded tanks where fish respiration depletes DO faster than circulation
restores it.

**Buffering solutions** (`applyConsumable`)

Calcium carbonate and potassium carbonate each raise pH by 0.2 and add the respective
mineral. pH falls naturally from nitrification (acid-forming) and from the pH Crash event
(−0.2/turn). Fish and plants both suffer health penalties when pH drifts outside 6.2–7.8.
Buffering is the primary defense against pH Crash and long-run acidification.

**Chelated iron** (`applyConsumable` with `chelatedIronDTPA11`)

Iron starts at a species-dependent baseline and falls from plant uptake. Plants suffer −0.5
health/day when iron is below 1.0 ppm. The plant disease event also reduces iron −0.5
ppm/turn. Chelated iron ($12) adds +1.0 ppm — a targeted, inexpensive fix for the specific
deficiency.

**Partial water change** (`performPartialWaterChange`)

Replaces a fraction of tank water with fresh water. Dilutes ammonia, nitrite, and nitrate
proportionally; also dilutes minerals. Used as an emergency ammonia reduction when biofilter
capacity is insufficient to handle a spike. A water change during an ammonia crisis buys time
to apply a biofilter unit or sell fish.

**Heater/Chiller** (`buyEquipment` with `heaterChiller`)

A one-time purchase ($150) that permanently tightens temperature drift from ±0.5°C/day to
±0.15°C/day and returns temperature toward 25°C three times faster. Temperature at 25°C is
optimal for tilapia. Barramundi requires 26–29°C. Temperature excursions outside species
tolerance apply stress multipliers to growth and can cause health loss. The BalancedBot buys
a heater/chiller on day 14 specifically to keep temperature in the barramundi optimal range
and improve the probability of the Stable Ecosystem Streak.

### 3.4 Repair

**Full repair** (`repairSystem`)

Restores the active event fully — circulation to 100% (pump failure), biofilter to pre-clog
efficiency (filter clog), tank refilled plus leak sealed (water leak). Costs: pump $100,
filter $50, leak $75.

**Quick repair** (`quickRepairSystem`)

Partial restoration at roughly half cost. For pump failure: circulation restored to 70% (not
100%). For filter clog: biofilter restored to 70% of pre-clog value. For water leak: drain
stopped but tank not refilled. Quick repair buys time when cash is low — the system continues
operating at reduced capacity while the player accumulates funds for a full repair.

---

## 4. Water Chemistry as a State Space

Six water parameters each have independent dynamics, thresholds, and health implications. The
player must track all six simultaneously, though the nitrogen parameters (ammonia, nitrite,
nitrate) are the most tightly coupled to daily decisions.

```
PARAMETER   STARTING VALUE  SAFE RANGE      DANGER THRESHOLD   CONSEQUENCE
──────────  ──────────────  ──────────────  ─────────────────  ──────────────────────────
Ammonia     0.00 ppm        0 – 0.5 ppm     > 1.5 ppm          Fish/plant health −(excess×0.2)/day
                                            > 0.5 ppm          Mechanical event prob ×2
Nitrite     0.00 ppm        0 – 0.25 ppm    > 0.5 ppm          (toxicity handled via ammonia chain)
Nitrate     5.00 ppm        5 – 80 ppm      < 3 ppm            Plant health −(3−NO₃)×0.4/day
                                            < 5 ppm            Plant growth rate = 85% floor
pH          7.00            6.5 – 7.5       < 6.2 or > 7.8     Fish/plant health −0.6 to −1.2/day
Temperature 25.00 °C        Species-range   Outside optimal    Growth multiplier penalty
Dissolved O₂ 8.0 mg/L      > 5 mg/L        < 3 mg/L           Fish stress, DO event risk
```

### 4.1 How Parameters Interact

The six parameters are not independent. Each is linked to the others through the daily
simulation pipeline:

**Ammonia → pH:** Nitrification is acid-forming. Every ppm of ammonia converted to nitrite
drops pH by −0.01. A tank with 15 fish producing heavy waste acidifies over time without
buffering. pH crashes are more likely in high-biomass systems.

**pH → Ammonia toxicity:** Ammonia exists in two forms — ionized (NH₄⁺, relatively safe) and
un-ionized (NH₃, toxic). At pH 7.0 roughly 1% is in the toxic form. This model simplifies by
treating total ammonia as the hazard metric, but the threshold values implicitly encode the
pH-toxicity relationship: the 1.5 ppm damage threshold assumes typical game pH (6.5–7.5).

**Pump failure → Ammonia and DO:** When the pump stops, circulation efficiency drops to near
zero. Two downstream effects fire simultaneously: nitrification stops (no water flow through
the biofilter), causing ammonia to accumulate; and dissolved oxygen stops being replenished by
circulation, causing a slow drop. An unrepaired pump failure creates a compound crisis that
worsens every day.

**Filter clog → Ammonia:** A clogged filter cuts biofilter efficiency in half. The same fish
population producing the same daily ammonia now has only half the processing capacity. For a
Balanced system (80% efficiency, 11 fish) this halves capacity from 2.0 to 1.0 ppm/day —
potentially insufficient to keep pace with waste production.

**Nitrate → Plant growth rate:** The growth multiplier is a smooth function of nitrate
concentration:

```
nitrateGrowthMult = clamp(0.85 + (nitrate − 5) / 75 × 0.30, 0.85, 1.15)

At nitrate:   0 ppm → 0.85  (85% growth; also taking health damage)
              5 ppm → 0.85  (floor, just above damage threshold)
             30 ppm → 0.95  (moderate)
             55 ppm → 1.05  (good)
             80 ppm → 1.15  (ceiling, 115% growth)
```

High nitrate accelerates plant maturation, enabling faster harvest cycles. This creates a
positive feedback: more fish → more nitrate → faster plant cycles → more revenue → buy more
fish. The feedback is bounded by the nitrate uptake rate (mature plants consume it as fast as
fish produce it) and by the ammonia danger zone (too many fish without enough biofilter
eventually triggers damage or events).

---

## 5. Biological Entities: Fish and Plants as Agents

### 5.1 Fish Lifecycle

Each fish is an independent agent with its own `id`, `type`, `weight`, `health`, and `age`.
Fish are not pooled — individual fish can die while others remain healthy.

```
FINGERLING (10 g, health 10)
  │
  │  Daily: weight += foodPortion × baseGrowthRate × stressMultiplier
  │  Daily: ammonia generated
  │  Daily: health -= if(ammonia > 1.5)  → ammonia toxicity
  │  Daily: health += slow recovery if conditions are good
  │
  ├── If unfed 5+ days: health declines toward 0
  ├── If ammonia > speciesMax: health −= excess × 0.2/day
  ├── If event: fishDiseaseOutbreak → health −= 1.5 for ~20% of fish/day
  │
  ▼
HARVESTABLE (≥ 80% of harvestWeight, health > 0)
  │  Player can sell for full market value
  │  Weight continues increasing past harvest weight
  │  If not sold: fish ages past max age → health starts declining
  ▼
DEATH (health ≤ 0)
  Fish removed from G.fish, recorded in lastAction.fishDeaths
  Ammonia load and nitrate demand both drop immediately
```

### 5.2 Plant Lifecycle

Plants are also independent agents. Each has a `slotIndex` (its 3D grow-bed position),
`growthStage` (seedling/growing/mature), `health` (0–10), and `age` (in simulation days).

```
SEEDLING (age 0, stage 0, health 10)
  │
  │  Daily: age += nitrateGrowthMult × ecosystemBonus
  │  Daily: nitrate uptake += 0.02 ppm
  │  → Transitions to GROWING at age ≥ growTime × 0.33
  ▼
GROWING
  │
  │  Daily: nitrate uptake += 0.04 ppm
  │  → Transitions to MATURE at age ≥ totalGrowthTime
  ▼
MATURE
  │
  │  Daily: nitrate uptake += 0.06 ppm (maximum)
  │  Player can harvest for market value
  │
  │  Health damage sources:
  │    nitrate < 3 ppm:  health −= (3 − nitrate) × 0.4 per day
  │    iron < 1 ppm:     health −= 0.5 per day
  │    pH < 6.2:         health −= 0.6 per day
  │    pH > 7.8:         health −= 0.6 per day
  │    pH < 5.5:         health −= 1.2 per day (severe)
  │    good conditions:  health += 0.15 per day (slow recovery)
  │
  │  If not harvested past 2× totalGrowthTime: health begins declining
  ▼
DEATH (health ≤ 0)
  Plant removed, slot freed, recorded in lastAction.plantDeaths
  Nitrate demand drops immediately
```

---

## 6. The Event System

Events are the game's primary source of unpredictability. They introduce crises that test the
player's preparedness and create moments where chemistry, biology, and economics all interact
under pressure.

### 6.1 Two-Phase Warning Architecture

Events always give one turn of warning before effects begin. This is enforced at the engine
level and cannot be bypassed even when advancing multiple days at once.

```
Day N:   EventManager.checkForRandomEvent(G) rolls for events
         A pump failure is selected
         G.pendingEvent = { id: 'pumpFailure', ... }
         lastAction.eventTriggered = true, eventPending = true
         UI shows amber warning: "Upcoming: Pump Failure — prepare now"

Day N+1: (top of runOneTurn) EventManager.promoteToActive(G)
         G.pendingEvent → G.activeEvent
         Effects begin: circulationStopped = true
         Nitrification near zero, DO stops recovering
         UI shows red card: "Active: Pump Failure — repair now"

Day N+2: Effects continue if unrepaired
         Ammonia rising, DO falling

... until player calls repairSystem() or quickRepairSystem()
```

When `progressMultipleTurns` is called (Progress 3 Days), any event detected during day 1 of
the batch causes the batch to stop immediately after day 1's effects are applied. The player
must respond before continuing. This prevents the silent compounding of damage across multiple
days.

### 6.2 Event Probability and Suppression

Events are not uniformly random. The probability of each event depends on the current game
state in two ways.

**Ammonia suppression of mechanical events:** When ammonia is below 0.5 ppm, pump failure,
filter clog, and water leak each fire at half their base probability. This is the game's core
sustainability reward: keeping water clean reduces equipment wear.

```
lowAmmoniaFactor = (ammonia < 0.5 ppm) ? 0.5 : 1.0

effectiveProb(pumpFailure) = 0.015 × lowAmmoniaFactor
  → clean system: 0.0075/day  ≈ expected 1 failure per 133 days
  → dirty system: 0.015/day   ≈ expected 1 failure per 67 days

effectiveProb(filterClog)  = 0.020 × lowAmmoniaFactor × highLoadFactor
effectiveProb(waterLeak)   = 0.020 × lowAmmoniaFactor
```

**Fish-load scaling of filter clog:** The filter clog probability also scales with fish count
above a baseline of 5 fish:

```
highLoadFactor = min(3.0, 1.0 + (fishCount − 5) × 0.2)

  5 fish:  ×1.0  → 0.020/day
 10 fish:  ×2.0  → 0.040/day
 15 fish:  ×3.0  → 0.060/day
```

Aggressive strategy (15 fish) faces a filter clog three times more often than Conservative
(5 fish), even when both keep ammonia low. This reflects real aquaponics: heavy fish loads
produce more solids regardless of water quality.

**Social event gating:** The School Tour event ($400 bonus) is entirely blocked when ammonia
≥ 0.5 ppm. No dirty system can earn this reward. The ammonia threshold encodes the game's
core philosophy: financial rewards accrue to systems that prioritize biological stability.

**Grace period:** No events fire during the first 7 days. This gives every player time to
establish fish, plant seeds, and stabilize chemistry before facing crises. The 7-day window
aligns with the earliest possible first harvest: buy food → buy fish → plant seeds → advance
3 days → advance 3 days → harvest.

### 6.3 Event Catalog and Mechanics

```
EVENT             DURATION  PROB/DAY  AMMONIA  EFFECTS
──────────────    ────────  ────────  ──────── ──────────────────────────────────────
ammoniaSpike         1       0.040    unscaled  +1.5 ppm ammonia, +0.3 ppm nitrite
nitriteSpike         1       0.030    unscaled  +0.8 ppm nitrite
lowDissolvedO₂       1       0.030    unscaled  −1.5 mg/L DO, circ eff −0.2
fishDiseaseOutbreak  2       0.015    unscaled  +1.0 NH₃, +0.5 NO₂, −1.5 health × 20% fish/day
plantDiseaseOutbreak 3       0.015    unscaled  −2.0 NO₃, −0.5 Fe, −1.2 health × 20% plants/day
pHCrash              2       0.025    unscaled  −0.2 pH/day for 2 days
waterLeak           999      0.020    × 0.5     −50 L/day until repaired
pumpFailure         999      0.015    × 0.5     circulation stopped until repaired
filterClog          999      0.020    × 0.5×N   biofilter × 0.5 until repaired
testEvent            1       0.020    unscaled  +$50 cash (social)
schoolTour           1       0.020    gated     +$400 cash (social; blocked if NH₃ ≥ 0.5)
```

Duration 999 means "until repaired." Pump failure, filter clog, and water leak are the
permanent-damage events — they persist indefinitely and worsen the system every day until the
player spends cash to repair them.

### 6.4 Repair Decision

Repair is an explicit choice between full restoration and partial restoration. The decision
trades cash now against risk later:

```
PUMP FAILURE

  Quick Repair ($50):  circulation → 70%
    Pro: cheaper, half price, immediate
    Con: nitrification at 70% capacity, DO recovery at 70%
         system is "limping" — marginally functional

  Full Repair ($100):  circulation → 100%
    Pro: complete restoration
    Con: double the cost; may force delayed harvest if cash is low

FILTER CLOG

  Quick Repair ($25):  biofilter → 70% of pre-clog efficiency
    Pro: affordable, stops the worst of the ammonia buildup
    Con: 30% deficit remains; heavy fish loads may still cause ammonia rise

  Full Repair ($50):   biofilter → 100% of pre-clog efficiency
    Pro: complete restoration

WATER LEAK

  Quick Repair ($37):  drain stopped, tank not refilled
    Pro: stops ongoing water loss; chemistry stabilizes
    Con: tank volume is reduced (lower dilution capacity); concentration effects
         on all parameters persist until manual water change or full repair

  Full Repair ($75):   drain stopped AND tank refilled to original capacity
    Pro: complete restoration; full dilution capacity restored
```

---

## 7. Economic Structure

### 7.1 Revenue Sources

The player earns money in five ways, in rough order of reliability:

```
1. Plant sales (frequent, predictable)
   Basil:   $3.10/head × 20 plants × 100 days / 5-day cycle = ~$1,240 max
   Romaine: $3.10/head × 20 plants × 100 days / 6-day cycle = ~$1,033 max

2. Fish sales (periodic, higher per-sale)
   Tilapia: $5.00/fish × 5 fish × 100 days / 6-day cycle = ~$416 max
   Barramundi: $13.00/fish × 5 fish × 100 days / 14-day cycle = ~$464 max

3. School Tour ($400 bonus)
   Fires at ~2% probability per day when ammonia < 0.5 ppm
   Expected over 100 days (clean system): ~2 events × $400 = $800

4. Market Day Bonus ($50)
   Fires at ~2% probability per day unconditionally after day 7
   Expected over 100 days: ~1.9 events × $50 = $95

5. Stable Ecosystem Bonus ($100, one-time)
   Awarded when ammonia < 1.2 ppm, DO > 6.0, pH 6.5–7.5 for 10 consecutive days
```

### 7.2 Cost Structure

```
STARTING CASH: $1,000

Fixed one-time costs:
  Fish food (10 units): $20/pack  (must buy before first harvest)
  Tilapia fingerling: $2.10 each
  Basil seed: $0.25 each
  Heater/Chiller: $150  (optional, improves barramundi performance)

Recurring consumable costs:
  Biofilter unit: $120  (when ammonia crisis or efficiency upgrade needed)
  Aeration stones: $25  (when DO drops below threshold)
  Buffering solution: $15  (when pH drifts below 6.5)
  Iron supplement: $12  (when iron below 1.0 ppm)

Utility costs (accrue daily, billed every 30 days):
  Electricity: pump + lighting + heaterChiller × 0.15/day
  Water: tankSize × evaporation + fishCount × 0.08/day
  (Typical 30-day bill: ~$50–$80)

Event repair costs (when events occur):
  Pump failure repair: $50 (quick) – $100 (full)
  Filter clog repair: $25 (quick) – $50 (full)
  Water leak repair: $37 (quick) – $75 (full)
```

### 7.3 Milestone Thresholds

The three milestones serve as checkpoints that measure financial progress:

```
Starting money:  $1,000
Established:     $1,500  (+$500 from start, unlocks at ~day 20–40 for most strategies)
Profitable:      $2,500  (+$1,500 from start, requires sustained revenue stream)
Thriving:        $5,000  (+$4,000 from start, game ends immediately — achievable only by
                          Aggressive with lucky event rolls; 0.7% of games)
```

---

## 8. Feedback Loops

The simulation model contains several interacting feedback loops. Understanding whether a loop
is positive (self-amplifying) or negative (self-correcting) helps explain why strategies
diverge and why some states are fragile.

### 8.1 The Core Positive Loop: Scale

```
More fish → more ammonia → more nitrification → more nitrate
                                                     │
                                                     ▼
                                             More plants (more nitrate budget)
                                                     │
                                                     ▼
                                             More plant revenue
                                                     │
                                                     ▼
                                             Buy more fish fingerlings
                                                     │
                                                     └──────────► More fish
```

This loop drives the Aggressive strategy's high revenue ceiling. It is bounded by two
negative loops (below).

### 8.2 Negative Loop 1: Ammonia Ceiling

```
Too many fish → ammonia exceeds biofilter capacity
                     │
                     ▼
               Ammonia accumulates
                     │
                     ├─► Fish health damage → fish deaths → reduced ammonia
                     ├─► Mechanical event probability doubles → repair costs
                     └─► Plant health damage → plant deaths → reduced nitrate demand
```

This loop caps unconstrained fish scaling. The Aggressive bot hits this ceiling regularly
(457 avg plant deaths, 14.7 avg fish deaths per game) because its 60-plant nitrate demand
outstrips its 15-fish nitrogen production capacity.

### 8.3 Negative Loop 2: Nitrate Floor

```
Too many plants → nitrate uptake exceeds production
                       │
                       ▼
                 Nitrate falls below 3 ppm
                       │
                       ▼
                 Plants lose health → plant deaths → reduced uptake
                       │
                       ▼
                 Nitrate stabilizes (fewer plants consuming it)
```

This loop auto-corrects over-planting at the cost of lost plants and lost revenue. It is the
primary loss mechanism for the Aggressive bot.

### 8.4 Positive Loop: Clean Water Rewards

```
Low ammonia (< 0.5 ppm)
     │
     ├─► Mechanical event probability halved → fewer repairs → more cash
     ├─► School Tour eligible ($400 bonus)
     └─► Stable Ecosystem Streak possible
               │
               ▼
         Fish grow 15% faster, plants mature 10% faster
               │
               ▼
         Faster harvest cycles → more revenue
               │
               ▼
         Invest in more fish/biofilter → maintain low ammonia
               │
               └──────────────────────────────────────► Low ammonia
```

This is the Conservative and Reactive strategy's core advantage — but only if they can also
generate enough nitrate for their plants.

### 8.5 The Stable Ecosystem Streak

The stable ecosystem streak is a convergence mechanic. It requires 10 consecutive days where
all three conditions are met simultaneously: ammonia < 1.2 ppm, dissolved oxygen > 6.0 mg/L,
and pH between 6.5 and 7.5. A single day outside any threshold resets the streak to zero.

Once achieved (day 10+), it awards $100 and applies growth multipliers. The Balanced bot earns
this streak in simulation because it buys a heater/chiller on day 14 (stabilizing temperature
for barramundi) and starts with modest fish count (11), keeping ammonia consistently below 1.2
ppm during the early game. The streak is recorded in `G.stableEcosystemDays`.

---

## 9. Putting It Together: Strategy Profiles as System Configurations

Each bot strategy is a different equilibrium point in the parameter space. Understanding a
strategy means understanding which loops it relies on and which constraints it accepts.

```
CONSERVATIVE: Minimal biomass, stable chemistry, low revenue ceiling
  Fish: 5 tilapia (ammonia ~ 0.5 ppm total, just at clean-water threshold)
  Plants: ≤20 at a time (nitrate budget: 5 × 0.1 = 0.5 ppm/day production)
  Result: Ammonia stays near 0 → mechanical events halved → almost no repair costs
          Nitrate stays at ~20 ppm → plants never starve, grow at full speed
          Revenue: ~$1,373/game (low fish count, low plant count)
          Risk: almost none — 0 avg fish deaths, 4.6 avg plant deaths (disease events only)

AGGRESSIVE: Maximum biomass, chemistry under stress, high revenue / high variance
  Fish: 15 barramundi+tilapia (ammonia ~ 2.5 ppm peak, toxic)
  Plants: 60 at a time (demand: 60 × 0.06 = 3.6 ppm/day uptake; supply: ~2.0 ppm/day)
  Result: Nitrate chronically depleted → ~457 plant deaths/game from deficiency
          Ammonia peaks > 2 ppm → fish health damage, barramundi die frequently
          Mechanical events × 3 for filter clog → highest repair costs ($249/game)
          Revenue: ~$2,467/game when it works; occasional $0 collapse (11.6% rate)
          Risk: high variance (σ = $1,089 vs. $507 for Balanced)

BALANCED: Moderate biomass, strategic heater/chiller purchase, streak optimization
  Fish: 11 barramundi+tilapia (ammonia ~1.3 ppm, below barramundi 1.0 ppm threshold?
         actually Balanced keeps barramundi under load → some deaths; heater stabilizes temp)
  Plants: ≤30 at a time
  Result: Nitrate adequate → near-zero plant deaths
          Stable ecosystem streak achieved → growth multipliers → faster revenue
          Heater/chiller investment pays back via faster barramundi growth
          Revenue: ~$2,541/game (highest gross revenue in the simulation)
          Risk: moderate (σ = $507)

REACTIVE: Minimal fish, minimal plants, repair-on-failure philosophy
  Fish: 5 tilapia
  Plants: ≤10 at a time (smallest nitrate demand)
  Result: Nitrate stays high (~41 ppm) → plants never deficient
          Almost no events (fewest mechanical due to clean water AND low fish load)
          Lowest revenue ($968/game) — too few plants and fish for meaningful output
          Highest rate of "None" milestone (16.1%) — revenue barely covers costs
```

---

## 10. The Decision Diamond: How Each Turn Should Be Analyzed

A player approaching each turn rationally works through a priority hierarchy:

```
1. Is there an active event?
   YES → Assess urgency:
     Damage event (pump/filter/leak): how many days of damage can I afford?
     Chemistry event (ammonia spike, nitrite rise): do I have biofilter stock?
     Disease event: are my fish/plants at critical health?
     → Repair or apply consumable before advancing

2. Is chemistry in warning zone?
   Ammonia > 0.5 ppm → Consider applying biofilter (if stock available) or water change
   Nitrate < 5 ppm with plants → Harvest some mature plants to reduce uptake; plan to sell fish
   DO < 5 mg/L → Apply aeration stones if available
   pH < 6.5 → Apply buffering solution

3. Are there things to harvest?
   Mature plants → harvest before they age past 2× grow time and decline
   Fish at harvest weight → sell; removes ammonia producer and generates cash

4. Are there things to buy?
   Fish food running low → buy before next feeding cycle
   Fish count below target → buy fingerlings if cash ≥ minMoney reserve
   Biofilter if ammonia is trending up → prophylactic investment

5. Advance the day
   Progress Day: safe when no emergency
   Progress 3 Days: faster when system is stable; stops automatically if crisis emerges
```

This hierarchy mirrors the bot decision pipeline exactly. The game rewards players who
internalize it because the underlying mechanics make it optimal: repairing before chemistry
compounds, harvesting before plants age out, maintaining biofilter ahead of ammonia spikes —
all reduce expected cost and increase expected revenue over the 100-day game.
