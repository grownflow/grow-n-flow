# Grow-n-Flow: Simulation Analysis & Balance History

The game went through five calibration rounds, each driven by headless bot simulations. This document records what each round revealed and how the numbers changed.

## Simulation Setup

| Parameter | Value |
|-----------|-------|
| Harness | `backend/scripts/run-simulations.js` / `backend/scripts/run-100k.js` |
| Scale | 2,500–25,000 games × 4 strategies per run |
| Game cap | 100 days per game |
| Milestone targets | Established $1,500 · Profitable $2,500 · Thriving $5,000 |
| Strategies | conservative, aggressive, balanced, reactive |
| Target ranking | **Balanced > Conservative > Reactive > Aggressive** (final money) |

---

## Calibration Rounds

| Round | Label | Key Changes |
|-------|-------|-------------|
| 1 | **v1** | Baseline — no biology fixes |
| 2 | **vFinal** | 7 biology & gameplay fixes |
| 3 | **+Prices** | Market prices +25%; fingerling costs reduced |
| 4 | **+Bonuses** | Stable Ecosystem $100 reward + 15% Bulk Harvest Bonus |
| 5 | **+Sustainability** | Zero-mortality bonus, ammonia-contingent events, school tour, widened ecosystem thresholds |

---

## Statistics by Round

### Final Money (avg, 100-day game)

| Strategy | v1 | vFinal | +Prices | +Bonuses | +Sustainability (100k) |
|----------|----|--------|---------|----------|------------------------|
| Conservative | $1,203 | $1,186 | $1,442 | $1,538 | $1,580 |
| Aggressive | **$1,742** | $369 | $1,506 | **$1,938** | **$2,044** |
| Balanced | $843 | $930 | $1,419 | $1,461 | $1,548 |
| Reactive | $963 | $984 | $1,184 | $1,262 | $1,308 |

*+Sustainability column = pre-tuning 100k baseline (25k games/strategy). Post-tuning results pending re-run.*

### Gross Revenue (avg, 100-day game)

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | $1,217 | $1,094 | $1,364 | $1,362 |
| Aggressive | **$2,866** | $1,148 | $2,252 | **$2,634** |
| Balanced | $2,221 | $1,978 | $2,463 | **$2,517** |
| Reactive | $822 | $768 | $957 | $956 |

### Milestone: Established (≥ $1,500)

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | ~1% | 1% | 41% | **66%** |
| Aggressive | ~1% | 11% | 65% | **97%** |
| Balanced | 0% | 0% | 35% | **50%** |
| Reactive | 0% | 0% | 1% | **6%** |

### Milestone: Profitable (≥ $2,500)

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | 0% | 0% | 0% | 0% |
| Aggressive | 0% | 0% | 15% | **37–41%** |
| Balanced | 0% | 0% | 0% | 0% |
| Reactive | 0% | 0% | 0% | 0% |

### Average Fish Deaths per Game

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | 0 | 0 | 0 | 0 |
| Aggressive | 13.5 | **29.9** | 14.3 | ~14 |
| Balanced | 0 | 0 | 0 | 0 |
| Reactive | 0 | 0 | 0 | 0 |

### Average Plant Deaths per Game

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | 2.5 | 4.1 | 3.2 | 3.3 |
| Aggressive | 156.7 | **599.1** | 405.8 | 401.9 |
| Balanced | 0 | 0 | 0 | 0 |
| Reactive | 0 | 0.3 | 0.4 | 0.3 |

### Peak Ammonia (avg ppm)

| Strategy | v1 | vFinal | +Prices | +Bonuses |
|----------|----|--------|---------|----------|
| Conservative | 0.41 | 0.40 | 0.41 | 0.40 |
| Aggressive | 3.49 | **3.58** | 2.52 | 2.53 |
| Balanced | 1.26 | 1.38 | 1.35 | 1.35 |
| Reactive | 0.39 | 0.38 | 0.38 | 0.39 |

---

## Round 1 → 2: The 7 Biology Fixes

**Core problem:** In v1, Aggressive dominated ($1,742 final money) despite overcrowding fish in toxic water. The simulation rewarded ecologically destructive play because the model lacked real aquaponics biology.

### Fix 1 — Ammonia-suppressed fish growth

Sublethal ammonia reduces feed conversion efficiency before visible health stress appears.

```
ammoniaGrowthFactor = clamp(1 − ammonia × 0.22, 0.10, 1.0)
```

| Ammonia (ppm) | Growth rate |
|---------------|-------------|
| 0.0 | 100% |
| 0.5 | 89% |
| 2.0 | 56% |
| 4.1+ | 10% (minimum) |

**Impact:** Aggressive (3.49 ppm peak) fish grew at ~10% of normal rate. Final money collapsed $1,742 → $369. This was the single most important fix.

### Fix 2 — Nitrate-proportional plant growth

Plants grow faster in nitrate-rich water, reflecting the real fertilisation mechanism.

```
nitrateGrowthMult = clamp(0.85 + (nitrate − 5) / 75 × 0.30, 0.85, 1.15)
```

| Nitrate (mg/L) | Growth multiplier |
|----------------|------------------|
| 5 | 0.85× |
| ~43 (midpoint) | 1.00× |
| 80+ | 1.15× |

**Impact:** Balanced — which maintains appropriate fish stocking and high nitrate — became the highest-revenue strategy ($1,978 vs Conservative's $1,094). The virtuous fish/plant cycle is now reflected in the numbers.

### Fix 3 — Progressive success milestones

Added milestone tracking at $1,500, $2,500, and $5,000 with turn-banner notifications. Immediately revealed that all milestones were unreachable in 100-day games at original prices (Conservative: 1%, Aggressive: 11%), driving the economic calibration in rounds 3–4.

### Fix 4 — Event probability rebalance + Quick Repair

Sensitivity analysis ranked events by impact on final money ($/pp change in probability):

| Rank | Event | Slope ($/pp) |
|------|-------|-------------|
| 1 | Pump Failure | −$42.62 |
| 2 | Filter Clog | −$37.88 |
| 3 | Water Leak | −$24.60 |
| 4 | Plant Disease | −$9.27 |
| 5 | Fish Disease | −$7.46 |
| 6 | pH Drop | +$7.01 ⚠ anomaly |
| 7 | Low DO | −$2.18 |
| 8 | Nitrite Rise | −$1.64 |
| 9 | Ammonia Spike | −$1.54 |

Pump Failure and Filter Clog together outweighed all nine other events combined. Their probabilities were reduced and Quick Repair options added:

| Event | Probability before | After | Quick Repair cost |
|-------|--------------------|-------|-------------------|
| Pump Failure | 2.0%/day | 1.5%/day | $50 (vs $100 full) |
| Filter Clog | 3.0%/day | 2.0%/day | $25 (vs $50 full) |
| Water Leak | 2.5%/day | 2.0%/day | $37 (vs $75 full) |

**pH Drop anomaly:** More pH events correlates with *more* final money (+$7.01/pp). Hypothesis: bots buying CaCO₃ buffering solution incidentally adds calcium, which benefits plants. Needs higher-sample investigation (n = 200).

### Fix 5 — Biofilter maturation curve

New tanks start at 55% biofilter efficiency (representing a partially seeded filter) and auto-mature to 80% over 14 days. Previously tanks started at full efficiency, making the nitrogen cycle too forgiving from day 1.

### Fix 6 — Stable ecosystem productivity bonus

10 consecutive days with NH₃ < 0.8 ppm, DO > 6.5 mg/L, and pH 6.8–7.2 unlocks +15% fish growth and +10% plant growth. The threshold was set at 0.8 ppm (not 0.3 ppm) so that a well-run conservative system can realistically earn it.

### Fix 7 — Temperature dynamics

Daily temperature follows an Ornstein-Uhlenbeck (mean-reverting) random walk. A Heater/Chiller unit ($150) tightens the drift and is especially important for barramundi (optimal 26–29°C).

| Condition | Daily drift | Reversion speed |
|-----------|-------------|----------------|
| No heater | ±0.5°C | 0.05 |
| With heater | ±0.15°C | 0.15 |

---

## Round 2 → 3: Price Calibration

**Core problem:** After the biology fixes, Established ($1,500) was reached in just 1% of Conservative games. Economic analysis showed the best-case 100-day ceiling was ~$2,222 — already below the Profitable target of $2,500. The game needed higher revenue per cycle.

### Market value increases (~25% across all species)

| Species | Before | After |
|---------|--------|-------|
| Tilapia | $4.00/unit | $5.00/unit |
| Catfish | $6.00/unit | $7.50/unit |
| Barramundi | $8.50/unit | $10.50/unit |
| Basil | $2.50/head | $3.10/head |
| Romaine | $2.50/head | $3.10/head |
| Pepper | $2.50/head | $3.10/head |
| Rosemary | $3.50/head | $4.40/head |
| Tomato | $3.50/head | $4.40/head |

**Impact:** Conservative Established rate 1% → 41%. Aggressive Profitable 0% → 15%.

---

## Round 3 → 4: Bonus Mechanics + Fingerling Cost Reduction

**Core problem:** Established was now achievable (41% Conservative) but Profitable (≥$2,500) remained rare outside Aggressive play. Two bonuses were added to reward the behaviors that lead to good outcomes — clean water management and farm scaling.

### Stable Ecosystem $100 one-time reward

When the 10-day stable streak is first achieved, the player receives a $100 cash bonus (guarded by `G.stableEcosystemRewarded` to prevent double-payment). This ties revenue directly to water quality discipline — the most important skill in aquaponics management.

**Who benefits:** Conservative (peak NH₃ 0.41 ppm — well below the 0.8 threshold). Balanced (1.36 ppm) does not reliably trigger it.

### Bulk Harvest Bonus (15%)

Harvesting 15 or more plants in a single `harvestAllMaturePlants` action applies a 15% premium to all unit prices in that batch. Rewards players who scale their grow beds and time harvests to batch mature plants together.

**Who benefits:** Aggressive (regularly harvests 15–20+ plants per batch). Conservative gains little (tends to harvest in small batches).

### Fingerling cost reductions

| Species | Before | After | Change |
|---------|--------|-------|--------|
| Tilapia | $2.50 | $2.10 | −16% |
| Catfish | $3.50 | $3.00 | −14% |
| Barramundi | $6.00 | $5.10 | −15% |

Lower restocking costs improve per-cycle margins for all strategies, especially Aggressive which restocks fish frequently.

### Barramundi market value increase

Barramundi was further increased from $10.50 → $13.00 to make its 14-day growth cycle competitive with tilapia for mid-to-late game play.

**Combined impact:** Conservative Established 41% → 66%; Aggressive Profitable 15% → 37%; Aggressive final money +$432.

---

## Key Findings

### 1. Biology must be fixed before economics
The biology fixes made the game scientifically accurate but rendered milestones unachievable. Economic calibration only came after the biology was correct. Had prices been raised first, the resulting milestones would have been based on broken game physics.

### 2. Clean water is now the dominant long-run strategy
Conservative and Balanced both run with zero fish and plant deaths. Aggressive generates more short-term revenue but spends heavily on restocking losses. Over 150–200 days, Balanced (high nitrate → fast plant cycles) would overtake Aggressive.

### 3. Bonuses should reinforce intended behavior
The two bonus mechanics directly reward the skills the game is teaching:
- **Stable Ecosystem reward** → water chemistry discipline
- **Bulk Harvest Bonus** → farm scaling and harvest timing

Both create positive feedback loops that make skilled play feel meaningfully rewarded.

### 4. Aggressive's plant deaths are a bot limitation, not a balance problem
The Aggressive bot loses 401 plants/game on average because it overstocks and lets ammonia run high. A human player using aggressive stocking principles but managing water chemistry would significantly outperform this figure. The bot is not a ceiling.

### 5. Reactive bot is under-tuned
Reactive generates only $957 in revenue despite surviving 100 days — less than Conservative ($1,364). The bot responds to alerts but does not farm proactively. Its poor performance is an AI strategy issue, not a game balance issue. Established rate of 6% reflects this.

### 6. pH Drop anomaly remains open
The sensitivity analysis found that more pH Drop events correlates with *higher* final money (+$7.01/pp). This is the only event with a positive slope. The most likely explanation is that bots buying CaCO₃ to buffer pH also incidentally add calcium (a plant macronutrient). A targeted n=200 sensitivity run on pH Drop alone would confirm or rule this out.

---

## Round 4 → 5: Sustainability Tunings

**Core problem (100k baseline):** Aggressive dominated ($2,044) despite 14 average fish deaths per game and 2.53 ppm peak ammonia. Conservative ($1,580) and Balanced ($1,548) both achieved 0 fish deaths and superior water quality but earned less money — the exact opposite of the intended ranking (Balanced > Conservative > Reactive > Aggressive).

**Target:** Adjust non-economic parameters so that biological discipline (clean water, zero mortality) translates into the highest financial returns.

### Fix 1 — Zero-Mortality Sustainability Bonus ($150/period)

A $150 bonus is awarded at each 30-day billing cycle when no fish died that period and at least one fish is present (`G.fishDeathsThisPeriod === 0`).

**Implementation:** `fishDeathsThisPeriod` counter increments on each fish death (tracked in `systemMoves.js`); resets to 0 after the billing check. The `$150` is added to `G.money` and exposed in `billPayment.sustainabilityBonus`.

| Strategy | Avg fish deaths | Expected bonus per game |
|----------|----------------|------------------------|
| Conservative | 0 | **+$450** (3 × $150) |
| Balanced | 0 | **+$450** |
| Reactive | 0 | **+$450** |
| Aggressive | ~14 | ~$0 (deaths in most periods) |

### Fix 2 — Ammonia-Contingent Mechanical Event Probability

When tank ammonia < 0.5 ppm, pump failure, filter clog, and water leak fire at **50% of their base probability**.

| Event | Base prob | Under 0.5 ppm |
|-------|-----------|---------------|
| Pump Failure | 1.5%/day | 0.75%/day |
| Filter Clog | 2.0%/day | 1.0%/day |
| Water Leak | 2.0%/day | 1.0%/day |

**Why mechanical events only:** These are the top-3 sensitivity drivers (sensitivity analysis slopes: −$42.62, −$37.88, −$24.60 per pp). Biological events (ammonia spike, disease) are already naturally suppressed by the nitrogen-cycle model in clean-water conditions — a second modifier there would double-count.

Conservative (avg 0.40 ppm) and Reactive (avg 0.39 ppm) spend most days below threshold. Balanced (avg 1.35 ppm) does not benefit from this modifier consistently. Aggressive (avg 2.53 ppm) never benefits.

**Expected savings (Conservative):** ~$100–130/game in avoided repair costs.

### Fix 3 — School Tour Social Event ($250, ammonia-gated)

A new social event fires at 1.5%/day but is skipped by EventManager when `ammonia ≥ 0.5 ppm`. Systems that maintain pristine water quality earn invitations from a local school, bringing a $250 community-income bonus.

**Implementation:** `ammoniaThreshold: 0.5` field on the event definition; `EventManager.checkForRandomEvent` skips the event when ammonia ≥ threshold before the probability roll.

**Who benefits:** Conservative (0.40 ppm) and Reactive (0.39 ppm) qualify on most days; Balanced (1.35 ppm) rarely qualifies; Aggressive (2.53 ppm) almost never qualifies.

### Fix 4 — Stable Ecosystem Bonus Threshold Widening

The 10-day stability streak thresholds were widened from "pristine" to "healthy":

| Parameter | Before | After |
|-----------|--------|-------|
| Ammonia max | < 0.8 ppm | < 1.2 ppm |
| Dissolved oxygen min | > 6.5 mg/L | > 6.0 mg/L |
| pH range | 6.8–7.2 | 6.5–7.5 |

**Why:** Balanced (1.35 ppm peak ammonia) was systematically excluded from the +15%/+10% growth multiplier bonus. Widening to 1.2 ppm brings Balanced into the eligible range, accelerating its fish and plant harvests over a 100-day game. Conservative (0.40 ppm) continues to qualify easily. Aggressive (2.53 ppm) still does not qualify.

### Target Post-Tuning Ranking

**Desired outcome: Balanced > Conservative > Reactive > Aggressive**

Balanced is targeted as the top-earning strategy because it combines:
- **Zero fish deaths** → full zero-mortality bonus (+$450)
- **High fish load → high nitrate** → fastest plant maturation cycles
- **Ecosystem bonus eligible** (threshold widened to NH₃ < 1.2 ppm) → +15% fish growth / +10% plant growth for a sustained mid-to-late game multiplier
- **Highest gross revenue baseline** ($2,517 vs. Conservative's $1,362) — the greatest raw harvest volume of any strategy

Conservative earns more repair savings and more school tour income (lower ammonia), but starts from a much lower revenue base ($1,362). Balanced's multiplied harvest revenue should exceed Conservative's savings.

| Strategy | Target rank | Key advantage |
|----------|-------------|--------------|
| **Balanced** | 1st | High fish/plant load × ecosystem growth multiplier |
| **Conservative** | 2nd | Zero deaths + ammonia-gated savings + school tour |
| **Reactive** | 3rd | Zero deaths + ammonia-gated savings; lower revenue base |
| **Aggressive** | 4th | High raw revenue but no sustainability bonuses |

Confirm with `node scripts/run-100k.js` after all tunings are applied.
