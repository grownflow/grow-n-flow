# Grow-n-Flow Aquaponics — 100,000-Game Statistical Analysis

**Run:** Round 9 (Nitrate Deficiency UX Fix) · 2026-06-24 · n = 25,000 games per strategy · 100-day cap per game

All values are derived from `backend/simulation-games-100k.csv` (100,000 rows). Statistics are per game unless labelled otherwise. ± values are one standard deviation (σ). Percentile columns show the distribution of individual game outcomes across 25,000 games per strategy.

## 1. Strategy Ranking — Final Money

| Rank | Strategy | Mean ± σ | Median | P25 – P75 | Profitable (≥ $2,500) | Thriving (≥ $5,000) |
|------|----------|---------|--------|-----------|----------------------|---------------------|
| 1 | **Balanced** | $2384 ± $507 | $2318 | $2001 – $2696 | 38.1% | 0.0% |
| 2 | **Conservative** | $2325 ± $492 | $2247 | $1945 – $2627 | 34.6% | 0.0% |
| 3 | **Aggressive** | $2287 ± $1089 | $2175 | $1471 – $3063 | 52.7% | 0.7% |
| 4 | **Reactive** | $1994 ± $485 | $1915 | $1600 – $2299 | 14.7% | 0.0% |

## 2. Core Financial Metrics (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Final money ($) | 2384 ± 507 | 2325 ± 492 | 2287 ± 1089 | 1994 ± 485 |
| Gross revenue ($) | 2541 ± 65 | 1373 ± 60 | 2467 ± 808 | 967 ± 13 |
| Repair costs ($) | 172 ± 107 | 134 ± 99 | 249 ± 147 | 119 ± 88 |
| Net profit ($) | 512 ± 136 | 524 ± 114 | 658 ± 882 | 238 ± 98 |
| Avg daily profit ($/day) | 5.12 ± 1.36 | 5.24 ± 1.14 | 6.60 ± 8.84 | 2.38 ± 0.98 |

## 3. Final Money — Percentile Distribution

Distribution of final money across 25,000 games per strategy:

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 1144 | 1065 | 0 | 985 |
| **P5** | 1683 | 1660 | 627 | 1348 |
| **P25** | 2001 | 1945 | 1471 | 1600 |
| **Median** | 2318 | 2247 | 2175 | 1915 |
| **P75** | 2696 | 2627 | 3063 | 2299 |
| **P95** | 3302 | 3211 | 4199 | 2851 |
| **Max** | 5046 | 5302 | 5534 | 4741 |

## 4. Gross Revenue — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 2090 | 803 | 643 | 842 |
| **P5** | 2439 | 1244 | 1335 | 942 |
| **P25** | 2493 | 1371 | 1797 | 962 |
| **Median** | 2534 | 1390 | 2359 | 970 |
| **P75** | 2592 | 1405 | 3087 | 976 |
| **P95** | 2648 | 1413 | 3894 | 982 |
| **Max** | 2700 | 1424 | 4253 | 1009 |

## 5. Milestone Outcomes

| Milestone | Balanced | Conservative | Aggressive | Reactive |
|-----------|----------|-------------|-----------|---------|
| **None (< $1,500)** | 0.8% | 0.7% | 1.1% | 16.1% |
| **Established (≥ $1,500)** | 61.1% | 64.8% | 46.2% | 69.2% |
| **Profitable (≥ $2,500)** | 38.1% | 34.5% | 52.0% | 14.7% |
| **Thriving (≥ $5,000)** | 0.0% | 0.0% | 0.7% | 0.0% |

## 6. Biological Outcomes (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Fish deaths per game | 0.0 ± 0.0 | 0.0 ± 0.0 | 14.7 ± 21.3 | 0.0 ± 0.0 |
| Plant deaths per game | 0.0 ± 0.0 | 4.6 ± 16.2 | 457.6 ± 250.0 | 0.3 ± 1.0 |
| Peak ammonia (ppm) | 1.305 ± 0.159 | 0.357 ± 0.120 | 2.535 ± 0.968 | 0.349 ± 0.126 |
| Final ammonia (ppm) | 0.086 ± 0.257 | 0.011 ± 0.057 | 1.215 ± 0.945 | 0.009 ± 0.052 |
| Final nitrate (ppm) | 46.6 ± 12.4 | 19.9 ± 6.3 | 1.0 ± 0.9 | 41.2 ± 14.4 |
| Days ammonia > 1.5 ppm | 4.1 ± 2.0 | 0.0 ± 0.0 | 31.5 ± 28.2 | 0.0 ± 0.0 |
| Days ammonia > 2.0 ppm | 0.0 ± 0.0 | 0.0 ± 0.0 | 6.5 ± 7.2 | 0.0 ± 0.0 |

## 7. Zero-Death Rates

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Games with 0 fish deaths** | 99.9% | 100.0% | 53.6% | 100.0% |
| **Games with 0 plant deaths** | 100.0% | 74.8% | 3.8% | 83.3% |
| **Games ending below start ($1,000)** | 0.0% | 0.0% | 11.6% | 0.0% |

## 8. Fish Deaths — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 0 | 0 | 0 | 0 |
| **P25** | 0 | 0 | 0 | 0 |
| **Median** | 0 | 0 | 0 | 0 |
| **P75** | 0 | 0 | 27 | 0 |
| **P95** | 0 | 0 | 60 | 0 |
| **Max** | 2 | 0 | 135 | 0 |

## 9. Events and Repairs (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Events encountered per game | 6.36 ± 2.15 | 5.61 ± 2.05 | 7.52 ± 2.60 | 5.22 ± 1.89 |
| Repair actions per game | 2.61 ± 1.56 | 1.84 ± 1.31 | 3.87 ± 2.21 | 1.64 ± 1.16 |
| Biofilter units bought | 0.13 ± 0.34 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 |
| First harvest day | 5.0 ± 0.0 | 5.0 ± 0.0 | 6.0 ± 0.0 | 5.0 ± 0.0 |
| Stable-ecosystem streak (final day count) | 1.9 ± 1.6 | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 |

| **Games with zero events** | 0.1% | 0.1% | 0.0% | 0.1% |

## 10. Events Encountered — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 3 | 2 | 3 | 2 |
| **P25** | 5 | 4 | 6 | 4 |
| **Median** | 6 | 6 | 7 | 5 |
| **P75** | 8 | 7 | 9 | 6 |
| **P95** | 10 | 9 | 12 | 8 |
| **Max** | 16 | 18 | 18 | 14 |

## 11. Repair Costs — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 0 | 0 | 50 | 0 |
| **P25** | 100 | 50 | 150 | 50 |
| **Median** | 150 | 125 | 225 | 100 |
| **P75** | 250 | 200 | 350 | 175 |
| **P95** | 375 | 325 | 525 | 275 |
| **Max** | 700 | 650 | 975 | 550 |

## 12. Peak Ammonia — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0.000 | 0.000 | 0.014 | 0.000 |
| **P5** | 1.160 | 0.265 | 1.246 | 0.265 |
| **P25** | 1.161 | 0.265 | 1.492 | 0.265 |
| **Median** | 1.321 | 0.310 | 2.845 | 0.265 |
| **P75** | 1.361 | 0.465 | 3.475 | 0.465 |
| **P95** | 1.544 | 0.498 | 3.775 | 0.492 |
| **Max** | 2.021 | 0.533 | 3.869 | 0.533 |

## 13. Derived Efficiency Metrics

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Revenue per fish death (games with deaths) | $2056 | N/A (0 deaths) | $189 | N/A (0 deaths) |
| Gross revenue per repair dollar | 14.8x | 10.3x | 9.9x | 8.1x |
| Events per day (avg) | 0.0636 | 0.0561 | 0.0752 | 0.0522 |
| Event repair rate (repairs/events) | 41.0% | 32.7% | 51.5% | 31.3% |
| Net profit per plant death (games with deaths) | $555.18 | $204.81 | $4.67 | $163.32 |

## 14. Head-to-Head Pairwise Comparisons

Probability that a randomly sampled game from Strategy A ends with more final money than a randomly sampled game from Strategy B (Monte Carlo, 1M random pairs):

| Matchup | P(A wins) | P(tie) | P(B wins) |
|---------|----------|--------|----------|
| **Balanced** vs Conservative | 53.7% | 0.0% | 46.3% |
| **Balanced** vs Aggressive | 55.4% | 0.0% | 44.6% |
| **Balanced** vs Reactive | 71.8% | 0.0% | 28.2% |
| **Conservative** vs Aggressive | 53.7% | 0.0% | 46.3% |
| **Conservative** vs Reactive | 68.8% | 0.0% | 31.2% |
| **Aggressive** vs Reactive | 57.1% | 0.0% | 42.9% |

## 15. Outcome Variance — Coefficient of Variation

CV = σ / mean × 100. Higher CV = more variable outcomes game-to-game.

| Metric | Balanced CV | Conservative CV | Aggressive CV | Reactive CV |
|--------|------------|----------------|--------------|------------|
| Final money | 21.3% | 21.2% | 47.6% | 24.3% |
| Gross revenue | 2.6% | 4.3% | 32.7% | 1.3% |
| Repair costs | 62.3% | 74.1% | 58.9% | 74.3% |
| Fish deaths | 3947.8% | N/A | 144.8% | N/A |
| Events | 33.8% | 36.5% | 34.5% | 36.2% |

## Notes

- All games run for exactly 100 days (time_limit outcome) except the rare games that reached the Thriving milestone ($5,000) before day 100.
- Starting money: $1,000. Net profit = final_money − $1,000.
- "Events encountered" includes all social (School Tour) and technical (pump failure, filter clog, water leak, disease, pH events) events.
- "Repair actions" counts only moves that invoked repairSystem or quickRepairSystem.
- Peak ammonia is the highest single-turn ammonia reading across the 100-day game.
- Head-to-head win rates use independent random sampling (1M pairs); ties are exact dollar matches (rare).
- Source data: `backend/simulation-results-100k.csv` (aggregates) and `backend/simulation-games-100k.csv` (per-game).

*Generated: 2026-06-24*