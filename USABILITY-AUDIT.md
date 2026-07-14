# Grow-n-Flow — Usability Audit

*Run: 2026-06-26 · 1,000 games (250 × 4 strategies) + static frontend audit*

---

## Method

**Simulation:** 1,000 headless games across all four strategies were run with instrumentation
added to track:
- How often each event fires per game
- For permanent-damage events (pumpFailure, filterClog, waterLeak): whether and how quickly
  they were repaired, and how many turns the bot couldn't afford repair
- For chemistry events (ammoniaSpike, nitriteSpike, pHCrash, etc.): whether water parameters
  returned to safe levels within the event's duration + 3 days

**Static audit:** Every event in `events.js` and every move in the moves index was checked
against the frontend UI to determine whether a human player can (a) see the problem,
(b) understand what to do, and (c) execute the fix without leaving the game.

---

## Part 1: Event Coverage — Simulation Results

### 1.1 Permanent Damage Events (last until repaired)

These require the player to spend cash to resolve. The simulation tests whether the repair path
is accessible and affordable.

| Event | Fires/game | Repair rate | Avg days to fix | Unrepaired games |
|-------|-----------|-------------|----------------|-----------------|
| filterClog | 1.29 | **98.8%** | 1.0 | 16 |
| pumpFailure | 0.52 | **99.4%** | 1.0 | 3 |
| waterLeak | 0.69 | **94.5%** | 3.4 | 38 |

**filterClog** and **pumpFailure** are repaired almost immediately (day 1). Bots can always
afford them because ConservativeBot ($200 buffer) and BalancedBot ($150 buffer) keep reserves.
The 16/3 unrepaired games are edge cases where the game ended (bankruptcy or time limit) before
repair was possible.

**waterLeak** takes longer (3.4 days average) because the Quick Repair ($37) is the first
affordable option and bots use Full Repair ($75) when their money buffer allows. The 38 unrepaired
games are primarily Reactive-strategy games where cash stays low.

**UI status for damage events: ✅ Well covered.**
- EventsPanel shows the pending event 1 turn before it activates.
- `EVENT_ACTION_GUIDE` covers all three: pumpFailure, filterClog, waterLeak.
- ActiveEventCard shows Quick Repair and Full Repair buttons with cost and affordability state.
- Buttons are disabled (not hidden) when the player can't afford them, with an "insufficient funds"
  message — no dead ends.

---

### 1.2 Chemistry Events (auto-expire, player must mitigate)

These events don't require repair — they expire after 1–3 turns. The simulation checks whether
water chemistry actually returns to safe levels after the event ends.

| Event | Fires/game | Chemistry recovery rate | Assessment |
|-------|-----------|------------------------|------------|
| pHCrash | 1.67 | **36.2%** ⚠️ | pH stays low long after event |
| plantDiseaseOutbreak | 0.94 | **69.0%** ⚠️ | Nitrate depletion persists |
| fishDiseaseOutbreak | 0.98 | **77.8%** | Mostly recovers; some games linger |

**pHCrash (36.2% recovery — critical gap):** The event drops pH −0.2/day for 2 days (−0.4 total).
Starting at pH 7.0, after a pH crash the tank settles at pH 6.6, which is still in the warning
zone. Nitrification is continuously acid-forming, so pH never recovers on its own — it drifts
further down each subsequent day. After 20+ days of nitrification without buffering, pH can be
below 6.2 (the damage threshold). The fix — applying a buffering solution (+0.2 pH each) — was
never triggered by bots because no bot strategy has a pH-check in its decision pipeline.

**Player fix added:** WaterSection now shows a proactive low-pH banner (⚠️ / 🚨) when pH < 6.5,
with a one-click "Apply Buffer / Buy Buffer & Apply" button. This mirrors the existing ammonia
and dissolved-oxygen quick-fix banners. See §3.1.

**plantDiseaseOutbreak (69% recovery):** The disease drains nitrate −2 ppm/day for 3 days
(−6 ppm total) and iron −0.5 ppm/day. If nitrate was near 10 ppm at disease start, it hits
the 3 ppm damage threshold by day 2. Bots don't have a `checkIron` routine so iron isn't
proactively corrected. Recovery improves when plants die (reducing uptake) or when fish waste
replenishes nitrate over several days.

**fishDiseaseOutbreak (77.8% recovery):** The event adds +1.0 ppm ammonia for 2 days. Bots
repair this passively through the nitrogen cycle (biofilter converts ammonia to nitrate). 22%
of events leave ammonia > 1.0 ppm for at least 3 days after the event — these are primarily
Aggressive games where ammonia was already elevated.

---

### 1.3 Short-Duration Events (duration = 1 turn)

Three events have `duration: 1`: ammoniaSpike, nitriteSpike, and lowDissolvedOxygen. These are
TECHNICAL events that go through the pending→active cycle, but their effects are applied and
the event clears within a single `progressTurn` call. The simulation's after-turn snapshot
always sees `G.activeEvent = null` for these, making them impossible to audit via post-turn
state inspection.

**What actually happens for players:**
1. Turn N: event detected. G.pendingEvent = "Ammonia Spike". Player sees amber warning card
   in EventsPanel with `EVENT_ACTION_GUIDE` text ("Buy a Buffering Solution or Biofilter…").
2. Player clicks Progress Day. Within that call:
   - Pending → active promotion fires first
   - Effects applied: ammonia +1.5 ppm
   - Event turnsRemaining: 1 → 0 → cleared within the same call
3. Player sees the new state: ammonia is now elevated (e.g., 0.04 → 1.54 ppm).
   WaterSection `highNitrogenActive` banner fires. One-click Fix N button appears.

**Assessment:** The warning system works correctly. Players get 1 turn of advance notice
(the pending card), then see elevated chemistry + the quick-fix banner after advancing.
The limitation is that the event card itself disappears immediately — the player needs to
recognize that the elevated ammonia they see in the post-turn state is the event's aftermath.
The WaterSection banner compensates for this.

---

### 1.4 Social Events

Social events (testEvent / Market Day Bonus, schoolTour / School Tour) award cash directly.
They do appear as activeEvent for 1 turn so players can see them, then clear naturally.

| Event | Notes |
|-------|-------|
| testEvent ($50) | Fires ~2%/day unconditionally; ~2 per 100-day game |
| schoolTour ($400) | Fires ~2%/day when ammonia < 0.5 ppm; ~2 per game for clean systems |

**UI status: ✅** Both appear in EventsPanel as green-background ActiveEventCard. No repair
button is shown (none needed). Event history records them.

---

## Part 2: Move Coverage — Frontend vs. Backend

Every move exported from `backend/src/game/moves/` was checked against Game.jsx button
handlers and the child component UI.

### 2.1 Moves with direct UI buttons

| Move | UI location | Wired via |
|------|------------|-----------|
| `progressTurn` | Game.jsx header bar | "Progress Day" button |
| `progressMultipleTurns` | Game.jsx header bar | "Progress 3 Days" button |
| `addFish` | FishTankSection | "Add Fish" button |
| `feedFish` | FishTankSection | "Add Food to Tank" button |
| `setAutoFeed` | FishTankSection | "Auto-feed: ON/OFF" toggle |
| `sellFish` | FishTankSection | "Sell" button per fish |
| `plantSeedsBulk` | PlantsSection | "Buy All Seeds" / "Plant All" |
| `plantSeed` | PlantsSection | Per-species plant buttons |
| `harvestAllMaturePlants` | PlantsSection | "Harvest All Mature" button |
| `harvestPlant` | PlantsSection | Per-plant harvest button |
| `buyEquipment` | MarketPanel | "Buy" per item |
| `applyConsumable` | WaterSection Supplements | "Apply 1" per item; also auto-buy+apply via banner buttons |
| `sellProducts` | InventoryPanel | "Sell All" per produce type |
| `repairSystem` | EventsPanel | "Full Repair — $N" button |
| `quickRepairSystem` | EventsPanel | "Quick Repair — $N" button |

### 2.2 Moves never called by bots but available to players

These moves exist in the backend and are wired in gameAPI.js but are not used by any bot
strategy. They are intended for human player use only.

| Move | Available in UI? | Notes |
|------|-----------------|-------|
| `quickRepairSystem` | ✅ EventsPanel | Bots always use full repair (they maintain cash reserves) |
| `progressMultipleTurns` | ✅ Game.jsx | Bots advance one day at a time |
| `feedFish` manually | ✅ FishTankSection | Bots rely on auto-feed |
| `setAutoFeed` | ✅ FishTankSection | Bots don't toggle this |
| `plantSeed` (single) | ✅ PlantsSection | Bots use bulk planting |
| `harvestPlant` (single) | ✅ PlantsSection | Bots always harvest all |

### 2.3 Moves with no player UI path — gaps

| Move | Bot usage | UI gap | Severity |
|------|-----------|--------|---------|
| `stopFeeding` | Never | No button to clear tank food | Medium |
| `removeFish` | Never | No button; only `sellFish` | Medium |
| `increaseAeration` | Never (uses `applyConsumable`) | No dedicated button | Low |
| `carePlant` | Never | No plant care UI at all | Low |
| `getEquipmentCatalog` | Never | Not a real player action (data fetch) | None |
| `skipTurn` | Never | No skip button | Low |

**`stopFeeding`:** The move clears food already in the tank (sets `tank.foodInTank = 0`). The
EventsPanel action guide for fishDiseaseOutbreak says "Stop feeding immediately." The player's
available action is to toggle Auto-feed OFF (setAutoFeed button in FishTankSection) which stops
new food from being added on future turns, and then manually not feeding. This achieves 90% of
the intent — only existing tank food isn't cleared. Recommend adding a "Stop Feeding & Clear
Tank Food" button in the FishTankSection disease banner (see §3.2).

**`removeFish`:** Players can only sell fish (requires harvest weight). If a sick fish is too
small to sell, the player cannot remove it. During fishDiseaseOutbreak, dying small fish will
produce ammonia as they deteriorate — but they can't be removed, only sold once large enough.
This is by design (sell at harvest weight), but the action guide says "Remove any dead fish"
which implies a remove action exists. Dead fish are actually auto-removed when `health ≤ 0`.

**`increaseAeration`:** This move adds DO directly without requiring an aeration stone.
The bot uses it as a fallback when `aerationStock === 0` and `DO < 4`. Players have no access
to this path — they must buy aeration stones from the Market. The WaterSection low-DO banner
handles this correctly (buys a pack then applies one in a single click).

**`carePlant`:** Accepted by gameAPI but no implementation is called from any UI component.
No plant care mechanic is described in any game documentation. Dead code — can be removed or
left as a future extension point.

**`skipTurn`:** No UI. Likely a debug tool. Players who want to advance without action use
progressTurn instead.

---

## Part 3: Fixes Applied

### 3.1 pH Warning Banner Added (WaterSection.jsx)

**Problem:** pHCrash events leave pH permanently depressed because nitrification is acid-forming.
No proactive UI existed to alert players or provide a one-click fix. pH recovery after pHCrash
events was only 36.2% in simulation.

**Fix:** Added a low-pH banner in WaterSection that fires when:
- pH < 6.5 (warning state), OR
- pH < 6.2 (danger state — fish and plants take health damage), OR  
- A pHCrash event is pending or active

The banner shows current pH, a description of consequences, and a one-click button that:
- Applies a buffering solution from inventory if stock > 0
- Buys a calcium-carbonate buffer ($15) and applies it if stock is empty and player can afford it
- Shows "Need $15 or buffer" if neither is possible

This matches the pattern established by the ammonia quick-fix and dissolved-oxygen quick-fix
banners that were already in WaterSection.

**Files changed:** `FlowFarmFrontend/src/components/WaterSection.jsx`

### 3.2 Recommended: Stop Feeding Context Banner (not yet implemented)

During fishDiseaseOutbreak, the EventsPanel action guide says "Stop feeding immediately."
The current UI path is: go to Fish tab → toggle Auto-feed to OFF. This is not immediately
obvious from the Events tab.

**Recommendation:** Add a contextual `stopFeeding` + `setAutoFeed(false)` compound action
button in the FishTankSection, visible only when `G.activeEvent.id === 'fishDiseaseOutbreak'`.
Display it as a yellow banner: "🐠 Fish Disease Active — Stop feeding to reduce ammonia [Stop
Feeding Now]". This clears tank food and disables auto-feed in one click.

**Requires:**
- `gameAPI.stopFeeding()` convenience wrapper in gameAPI.js
- `handleStopFeeding` in Game.jsx (calls stopFeeding then setAutoFeed(false))
- Banner JSX in FishTankSection (conditional on active event ID)

---

## Part 4: Event Action Guide Coverage

The `EVENT_ACTION_GUIDE` in EventsPanel.jsx has an entry for every TECHNICAL event:

| Event | Guide text present | Guide accurate? |
|-------|-------------------|----------------|
| pumpFailure | ✅ | ✅ |
| filterClog | ✅ | ✅ |
| waterLeak | ✅ | ✅ |
| ammoniaSpike | ✅ | ✅ |
| nitriteSpike | ✅ | ✅ |
| lowDissolvedOxygen | ✅ | ✅ |
| fishDiseaseOutbreak | ✅ | ⚠️ "Remove any dead fish" — dead fish are auto-removed by engine; this confuses players |
| plantDiseaseOutbreak | ✅ | ⚠️ Does not mention iron depletion; guide says "Check nitrate and iron levels" but doesn't link to the iron WaterStat |
| pHCrash | ✅ | ✅ (but only shows during pending — proactive pH banner now supplements this) |

**Recommended text fix for fishDiseaseOutbreak:**
```
OLD: 'Stop feeding immediately to reduce ammonia. Perform a Partial Water Change to lower stress. Remove any dead fish.'
NEW: 'Turn Auto-feed OFF in the Fish tab to stop adding food. Perform a Partial Water Change to dilute ammonia. Dead fish are removed automatically — focus on keeping survivors healthy.'
```

**Recommended text fix for plantDiseaseOutbreak:**
```
OLD: 'Check nitrate and iron levels — add Chelated Iron if iron < 1 ppm. Harvesting mature plants now reduces disease spread.'
NEW: 'Disease depletes nitrate (−2 ppm/day) and iron (−0.5 ppm/day) for 3 days. Go to the Water tab and apply Chelated Iron if iron < 1 ppm. Harvest any mature plants now — fewer plants means less nitrate consumption until the disease clears.'
```

---

## Part 5: Summary Table

| Area | Status | Action |
|------|--------|--------|
| Damage event repair UI | ✅ Complete | None |
| Ammonia/nitrite quick-fix banner | ✅ Complete | None |
| Dissolved oxygen quick-fix banner | ✅ Complete | None |
| Nitrate deficiency banner | ✅ Complete | None |
| **pH low-state banner** | ✅ **Fixed this session** | Deployed |
| pHCrash action guide | ✅ Text correct | None |
| fishDiseaseOutbreak action guide | ⚠️ Minor text fix | Update "remove dead fish" text |
| plantDiseaseOutbreak action guide | ⚠️ Minor text fix | Add explicit mention of iron |
| `stopFeeding` UI | ⚠️ No button | Add disease-context banner in FishTankSection |
| `removeFish` UI | ⚠️ No button | By design (sell only), but update event guide text |
| `carePlant` UI | ℹ️ No mechanic | Dead code; leave or remove |
| Short-duration events (1-turn) | ✅ WaterSection banners compensate | None |

*Generated: 2026-06-26*
