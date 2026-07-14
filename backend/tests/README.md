# Backend Tests

## Structure

```
tests/
├── integration/
│   └── game.integration.test.js   — HTTP API workflow (create match, moves, state)
└── unit/
    ├── api/
    │   ├── matchHandler.test.js   — match creation and retrieval handlers
    │   └── routes.test.js         — route registration and 404 behaviour
    ├── models/
    │   ├── Fish.test.js           — fish growth, feeding, mortality model
    │   ├── Plant.test.js          — plant growth stages and harvest model
    │   └── WaterChemistry.test.js — nitrogen cycle and parameter clamping
    └── moves/
        ├── economyMoves.test.js   — billing, selling, market transactions
        └── fishMoves.test.js      — addFish, feedFish, sellFish moves
```

Run all tests:

```bash
npm test
```

Run with coverage:

```bash
npm run test:coverage
```

---

## Bot Strategies

The simulation (`src/simulation/`) uses four bot strategies to model distinct player archetypes. Each strategy drives the same decision pipeline — `handleCriticalIssues → checkWaterChemistry → checkHarvests → checkPurchases → checkFeeding` — but with different thresholds, priorities, and risk tolerance.

The target ranking by final money over a 100-day game is:
**Balanced > Conservative > Aggressive > Reactive**

---

### Balanced

**File:** `src/simulation/BotStrategies.js` — `BalancedBot`

**Parameters:** `minMoneyBuffer: $150`, `maxTilapia: 8`, `maxBarramundi: 3`, `maxPlants: 30`, `riskTolerance: 0.5`

**Description:** Grows a mixed fish and plant system at a moderate pace, maintaining water quality margins rather than chasing maximum stock density. Builds a tilapia base first (up to 8), then diversifies with barramundi (up to 3) for higher-value harvests. Plants alternate between Basil and Romaine in batches of 10 for species diversity. Responds to water chemistry warnings before they become crises — applies biofilter at 0.8 ppm ammonia and performs a water change at 1.0 ppm. Repairs any active damage promptly, falling back to quick repair when the full cost would breach its money buffer. After day 14, buys a Heater/Chiller unit ($150) to stabilise temperature near 25 °C, reducing daily drift from ±0.5 °C to ±0.15 °C — this keeps barramundi closer to their optimal range and makes the 10-day stable-ecosystem streak easier to maintain.

**Why it wins:** Balanced operates in the "clean-enough" zone — ammonia averages ~1.3 ppm, low enough to avoid the 1.5 ppm health drain penalty and high enough to generate substantial revenue ($2,500+). Its 10–11 fish earn the healthy-population billing bonus ($50/period × 3 = $150/game) while also qualifying for the stable-ecosystem growth multiplier more frequently than Aggressive. High revenue plus manageable penalties equals the top outcome.

**How a live player adopts this strategy:**
- Start with 2–3 tilapia in the first week. Watch ammonia; buy a biofilter unit when it climbs past 0.5 ppm.
- Expand to 6–8 tilapia over the first month before spending on barramundi.
- Once you have 4+ tilapia established, add 1–2 barramundi for premium harvest value.
- Plant Basil (fast 5-day cycle) for early income, then rotate into Romaine for variety.
- Keep $150 in reserve at all times. Repair damage as soon as it appears — water leaks and pump failures are cheaper to fix early than to let run.
- Perform a partial water change whenever ammonia exceeds 1.0 ppm. Don't wait for fish stress.
- Check the stable-ecosystem counter: 10 consecutive clean days unlock a growth bonus that compounds on your large fish/plant population.

---

### Conservative

**File:** `src/simulation/BotStrategies.js` — `ConservativeBot`

**Parameters:** `minMoneyBuffer: $200`, `maxFish: 5`, `maxPlants: 20`, `riskTolerance: 0.2`

**Description:** Runs a small, stable system with absolute priority on water quality and cash reserves. Stocks only tilapia (hardy, cheap) and never exceeds 5 fish. Proactively upgrades the biofilter at 70% load rather than waiting for ammonia to rise. Reacts to dissolved oxygen dropping below 4.5 mg/L and applies biofilter from inventory when ammonia exceeds 0.5 ppm — well before danger levels. Maintains a $200 cash reserve at all times, funding quick repairs before they become emergencies and keeping a stock of aeration stones and buffering solution.

**Why it finishes second:** Conservative avoids nearly every penalty (ammonia < 0.5 ppm triggers half the mechanical event rate; zero fish deaths; near-certain school tour and ecosystem bonus eligibility). But its low fish/plant count caps revenue at ~$1,370. The healthy-population billing bonus ($25/period × 3 = $75/game) rewards its 5 fish for clean operation, but the smaller stocking limits total income compared to Balanced.

**How a live player adopts this strategy:**
- Stock 2 tilapia immediately, then add 1–2 more after your first billing cycle clears.
- Never exceed 5 fish total. The biofilter and your peace of mind will thank you.
- Buy a biofilter unit as soon as ammonia approaches 0.5 ppm — this is a warning, not a crisis.
- Keep at least 5 aeration stones and 2 buffering solution packs in inventory at all times.
- Always maintain $200 in the bank. If spending would drop you below that, wait.
- Plant the first 10 slots with Basil (fastest payback), then fill remaining beds with Romaine.
- Repair any system damage immediately, even if it means using the $37 quick repair rather than waiting to save $75.
- The school tour event (ammonia < 0.5 ppm, $400) fires frequently for this strategy — clean water is your revenue stream beyond fish.

---

### Aggressive

**File:** `src/simulation/BotStrategies.js` — `AggressiveBot`

**Parameters:** `minMoneyBuffer: $50`, `maxFish: 15`, `maxPlants: 60`, `riskTolerance: 0.9`

**Description:** Maximises stock density as fast as possible — up to 15 fish (barramundi preferred for higher value, tilapia as filler) and 60 Basil plants (fastest cash turnover). Keeps only $50 in reserve, spending nearly everything on growth. Water chemistry only warrants action at critical levels: dissolved oxygen below 4.0 mg/L or ammonia above 2.0 ppm triggers an emergency water change; biofilter is applied reactively when ammonia is already at 1.5+ ppm. Pump failure gets repaired immediately (kills circulation), but other damage events wait until the bank is $100+ above the repair cost.

**Why it finishes third:** High stocking density drives ammonia to ~2.4 ppm on average, above the 1.5 ppm threshold where fish and plant health drain each day. The biofilter clogs 3× more often at 15 fish than at 5 (load factor scales clog probability up to 3×), and each clog cascades into higher ammonia and more health damage. Fish deaths average ~14 per game. Despite gross revenue exceeding $2,400, the compounding penalties bring net money below Conservative.

**How a live player adopts this strategy:**
- Spend almost everything immediately: fish, plants, and more fish.
- Prefer barramundi when you can afford them ($5.10 each); fill gaps with tilapia ($2.10 each).
- Plant Basil wall-to-wall — 5-day harvest cycle means constant cash flow.
- Ignore ammonia readings until they hit 2.0 ppm, then do an emergency water change.
- Keep $50 in reserve only. Reinvest everything else in stock.
- Fix pump failures right away (circulation loss kills fish fast). Other events can wait until you're cash-flush.
- Accept that fish will die. The revenue from the surviving majority outweighs individual losses — or so the theory goes.

---

### Reactive

**File:** `src/simulation/BotStrategies.js` — `ReactiveBot`

**Parameters:** `minMoneyBuffer: $50`, `maxFish: 5`, `maxPlants: 10`, `riskTolerance: 0.3`

**Description:** Models a new or disengaged player who only acts when a problem is already visible. Stocks fish one at a time and only when ammonia is low AND cash is $100+ above the minimum. Plants a maximum of 10 seeds total — a small 3-seed batch only when money is comfortable ($80+ above minimum). Buys fish food only when completely out (rather than maintaining a reserve). Repairs system damage only when it's either near-fatal (water leak below 40% tank volume) or trivially affordable (cost < 33% of current money). Water chemistry response kicks in only at danger thresholds: DO below 4.0, ammonia above 1.5 for biofilter, 2.0 for a water change.

**Why it finishes last:** Slow stocking (small fish/plant cap, high spending threshold) limits gross revenue to under $1,000. The low fish count ($25/period healthy-population billing bonus × 3 = $75/game) and infrequent school tours (too few fish to establish quickly) leave little upside. Roughly 16% of games fail to reach any milestone at all (none milestone). However, Reactive avoids the biological penalties of Aggressive — ammonia stays near 0.35 ppm, fish deaths are minimal, and repair costs are low — so it remains solvent throughout.

**How a live player adopts this strategy (what NOT to do):**
- Wait until you have plenty of money before buying fish or plants.
- Don't bother checking water chemistry until the alerts turn red.
- Let fish food run out before restocking.
- Watch a water leak run for days before deciding to fix it.
- Only plant a few seeds at a time, and only when cash feels comfortable.
- React to events when they're critical, not when they're preventable.
- This is the "I'll deal with it later" approach — survivable, but rarely profitable.
