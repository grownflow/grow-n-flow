# Round 8 → Round 9 Delta Report

**Round 8:** 2026-06-24T07:11 (100,000 games)
**Round 9:** 2026-06-24T08:34 (100,000 games) — Nitrate Deficiency UX Fix

---

## What Changed in Round 9

Three UX/diagnostic fixes were applied before this run:

| Layer | Change | Affects simulation? |
|-------|--------|-------------------|
| **Frontend** (`WaterSection.jsx`) | Nitrate danger indicator threshold: 1 ppm → 3 ppm (matches backend damage threshold) | No — UI only |
| **Frontend** (`WaterSection.jsx`) | Added Low Nitrate Warning banner (shows < 5 ppm, red < 3 ppm, explains corrective actions) | No — UI only |
| **Backend** (`systemMoves.js`) | Fixed `createSystemAlerts` text at nitrate ≤ 1 ppm ("ammonia accumulating" → correct deficiency guidance); added alert at the actual 3 ppm damage threshold | No — bots do not read `G.systemAlerts` |
| **Backend** (`systemMoves.js`) | `progressMultipleTurns` early-exit: added plant deaths and nitrate < 3 ppm as stop conditions | No — bots call `progressTurn`, not `progressMultipleTurns` |

**Net effect on simulation engine: zero.** All changes are in the human-player feedback layer. Bot strategies read raw `G` state values; they do not consult `G.systemAlerts`, frontend threshold constants, or the Progress 3 Days batch logic.

---

## Aggregate Delta

| Strategy | R8 Avg $ | R9 Avg $ | Δ $ | Δ % |
|----------|---------|---------|-----|-----|
| Balanced | $2,382 | $2,384 | +$2 | +0.1% |
| Conservative | $2,334 | $2,325 | −$9 | −0.4% |
| Aggressive | $2,287 | $2,287 | −$1 | 0.0% |
| Reactive | $1,999 | $1,994 | −$5 | −0.3% |

All deltas are within normal run-to-run sampling variance (σ ≈ $490–1,100 per strategy). **The ranking is unchanged: Balanced > Conservative > Aggressive > Reactive.**

---

## Full Metric Comparison

### Final Money (mean)

| Strategy | R8 | R9 | Δ |
|----------|----|----|----|
| Balanced | $2,382 | $2,384 | +$2 |
| Conservative | $2,334 | $2,325 | −$9 |
| Aggressive | $2,287 | $2,287 | −$1 |
| Reactive | $1,999 | $1,994 | −$5 |

### Gross Revenue (mean)

| Strategy | R8 | R9 | Δ |
|----------|----|----|----|
| Balanced | $2,540 | $2,541 | +$1 |
| Conservative | $1,374 | $1,373 | −$1 |
| Aggressive | $2,472 | $2,467 | −$5 |
| Reactive | $968 | $968 | $0 |

### Repair Costs (mean)

| Strategy | R8 | R9 | Δ |
|----------|----|----|----|
| Balanced | $173 | $172 | −$1 |
| Conservative | $133 | $134 | +$1 |
| Aggressive | $250 | $249 | −$1 |
| Reactive | $117 | $119 | +$2 |

### Biological Outcomes (mean)

| Metric | R8 Bal | R9 Bal | R8 Con | R9 Con | R8 Agg | R9 Agg | R8 Rea | R9 Rea |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| Fish deaths | 0.0 | 0.0 | 0.0 | 0.0 | 14.8 | 14.7 | 0.0 | 0.0 |
| Plant deaths | 0.0 | 0.0 | 4.5 | 4.6 | 455.7 | 457.6 | 0.3 | 0.3 |
| Peak NH₃ (ppm) | 1.306 | 1.305 | 0.356 | 0.357 | 2.540 | 2.535 | 0.348 | 0.349 |
| Final nitrate (ppm) | 46.5 | 46.6 | 19.9 | 19.9 | 1.0 | 1.0 | 41.3 | 41.2 |

### Events (mean per game)

| Metric | R8 Bal | R9 Bal | R8 Con | R9 Con | R8 Agg | R9 Agg | R8 Rea | R9 Rea |
|--------|--------|--------|--------|--------|--------|--------|--------|--------|
| Events encountered | 6.35 | 6.36 | 5.61 | 5.61 | 7.56 | 7.52 | 5.18 | 5.22 |
| Repair actions | 2.61 | 2.61 | 1.83 | 1.84 | 3.90 | 3.87 | 1.62 | 1.64 |

---

## Milestone Distribution Delta

| Milestone | R8 Bal | R9 Bal | R8 Con | R9 Con | R8 Agg | R9 Agg | R8 Rea | R9 Rea |
|-----------|--------|--------|--------|--------|--------|--------|--------|--------|
| None (< $1,500) | 0.7% | 0.8% | 0.8% | 0.7% | 1.2% | 1.1% | 15.7% | 16.1% |
| Established | 62.0% | 61.1% | 63.7% | 64.8% | 46.1% | 46.2% | 69.7% | 69.2% |
| Profitable | 37.3% | 38.1% | 35.6% | 34.5% | 52.0% | 52.0% | 14.6% | 14.7% |
| Thriving | 0.0% | 0.0% | 0.0% | 0.0% | 0.7% | 0.7% | 0.0% | 0.0% |

---

## Interpretation

**Why the delta is noise:** The nitrate deficiency changes were entirely in the human-player feedback and safety layers:

- The **3 ppm damage threshold** was already present in the game engine (`backend/src/game/moves/systemMoves.js:256`) before this round. Plants were already dying from nitrate deficiency in Round 8 — the engine behavior is unchanged.
- The bot strategies respond to raw water chemistry values (e.g., `water.nitrate < X`) directly, not to UI alerts or threshold color codes.
- The `progressMultipleTurns` early-exit conditions added affect only human players who click "Progress 3 Days." Bot simulations call `progressTurn` once per tick.

**What the Round 9 run confirms:**
- Aggressive's final nitrate remains 1.0 ppm (±0.9) on average — many games end at or near 0. Plant deaths (457.6/game) remain severe. The fix surfaces this condition more clearly to a human player, but the underlying mechanic is unchanged.
- The ranking **Balanced > Conservative > Aggressive > Reactive** is stable across independent runs of 25,000 games per strategy.
- Conservative's 4.6 avg plant deaths are largely from plant disease outbreak events (which reduce nitrate −2.0 ppm over 3 turns) and plant aging past 2× grow time — **not** from chronic nitrate depletion. Conservative keeps < 20 plants; its nitrate stays at 19.9 ppm on average.

**What this UX fix does for human players (not visible in simulation):**
- The nitrate danger color turns red at 3 ppm instead of 1 ppm — 2 days of warning before the point where a plant at full health would die in 8 days at zero nitrate.
- The alert fires at 3 ppm with accurate guidance ("add fish or harvest mature plants") instead of at 1 ppm with a backwards explanation ("ammonia accumulating").
- "Progress 3 Days" now interrupts at the first plant death or first turn with nitrate < 3 ppm, rather than letting 3 days of damage compound silently.

---

## To Actually Reduce Aggressive Plant Deaths

The 457 avg plant deaths in Aggressive are caused by a fundamental imbalance: 60 Basil plants consume up to 3.6 ppm/day of nitrate (60 × 0.06 at mature stage) while 15 fish at 2.5 ppm avg ammonia nitrify roughly 2.0 ppm/day into nitrate. Net: ~−1.6 ppm/day, depleting from the starting 5 ppm to 0 in ~3 days.

Options (engine-level, not UX):

| Option | Mechanism | Trade-off |
|--------|-----------|-----------|
| Increase starting nitrate | Raise `water.nitrate` initial value (currently 5 ppm) | More runway before deficiency; doesn't fix the chronic imbalance |
| Cap plant nitrate uptake | Reduce per-plant uptake (currently 0.06 ppm mature) | Reduces deficiency risk; decouples plant/fish balance |
| Scale uptake with nitrate | Make uptake drop below threshold (e.g., `uptake *= nitrate / 5` below 5 ppm) | Realistic Michaelis-Menten uptake; plants slow automatically in low nitrate before dying |
| Bot constraint: max plants proportional to fish | AggressiveBot caps plant count at `fishCount × 4` rather than hardcoded 60 | Fixes Aggressive specifically; doesn't help human players who over-plant |

*Generated: 2026-06-24*
