# Grow-n-Flow Aquaponics — 100,000-Game Statistical Analysis

**Run:** Round 8 · 2026-06-24 · n = 25,000 games per strategy · 100-day cap per game

All values are derived from `backend/simulation-games-100k.csv` (100,000 rows). Statistics are per game unless labelled otherwise. ± values are one standard deviation (σ). Percentile columns show the distribution of individual game outcomes across 25,000 games per strategy.

## 1. Strategy Ranking — Final Money

| Rank | Strategy | Mean ± σ | Median | P25 – P75 | Profitable (≥ $2,500) | Thriving (≥ $5,000) |
|------|----------|---------|--------|-----------|----------------------|---------------------|
| 1 | **Balanced** | $2382 ± $500 | $2316 | $2014 – $2687 | 37.3% | 0.0% |
| 2 | **Conservative** | $2334 ± $496 | $2256 | $1948 – $2637 | 35.6% | 0.0% |
| 3 | **Aggressive** | $2287 ± $1100 | $2175 | $1455 – $3075 | 52.7% | 0.7% |
| 4 | **Reactive** | $1999 ± $485 | $1926 | $1604 – $2301 | 14.6% | 0.0% |

## 2. Core Financial Metrics (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Final money ($) | 2382 ± 500 | 2334 ± 496 | 2287 ± 1100 | 1999 ± 485 |
| Gross revenue ($) | 2540 ± 65 | 1374 ± 59 | 2472 ± 813 | 968 ± 13 |
| Repair costs ($) | 173 ± 107 | 133 ± 100 | 250 ± 148 | 117 ± 88 |
| Net profit ($) | 511 ± 137 | 525 ± 114 | 661 ± 888 | 240 ± 98 |
| Avg daily profit ($/day) | 5.11 ± 1.37 | 5.25 ± 1.14 | 6.62 ± 8.90 | 2.40 ± 0.98 |

## 3. Final Money — Percentile Distribution

Distribution of final money across 25,000 games per strategy:

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 964 | 1073 | 0 | 991 |
| **P5** | 1679 | 1658 | 623 | 1350 |
| **P25** | 2014 | 1948 | 1455 | 1604 |
| **Median** | 2316 | 2256 | 2175 | 1926 |
| **P75** | 2687 | 2637 | 3075 | 2301 |
| **P95** | 3294 | 3233 | 4235 | 2854 |
| **Max** | 5169 | 5034 | 5453 | 4348 |

## 4. Gross Revenue — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 2190 | 855 | 644 | 822 |
| **P5** | 2439 | 1249 | 1330 | 943 |
| **P25** | 2492 | 1371 | 1797 | 962 |
| **Median** | 2535 | 1391 | 2359 | 970 |
| **P75** | 2591 | 1405 | 3109 | 976 |
| **P95** | 2648 | 1413 | 3893 | 983 |
| **Max** | 2698 | 1423 | 4247 | 1013 |

## 5. Milestone Outcomes

| Milestone | Balanced | Conservative | Aggressive | Reactive |
|-----------|----------|-------------|-----------|---------|
| **None (< $1,500)** | 0.7% | 0.8% | 1.2% | 15.7% |
| **Established (≥ $1,500)** | 62.0% | 63.7% | 46.1% | 69.7% |
| **Profitable (≥ $2,500)** | 37.3% | 35.6% | 52.0% | 14.6% |
| **Thriving (≥ $5,000)** | 0.0% | 0.0% | 0.7% | 0.0% |

## 6. Biological Outcomes (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Fish deaths per game | 0.0 ± 0.0 | 0.0 ± 0.0 | 14.8 ± 21.3 | 0.0 ± 0.0 |
| Plant deaths per game | 0.0 ± 0.0 | 4.5 ± 15.8 | 455.7 ± 251.8 | 0.3 ± 0.9 |
| Peak ammonia (ppm) | 1.306 ± 0.160 | 0.356 ± 0.121 | 2.540 ± 0.967 | 0.348 ± 0.128 |
| Final ammonia (ppm) | 0.087 ± 0.257 | 0.011 ± 0.058 | 1.218 ± 0.944 | 0.010 ± 0.054 |
| Final nitrate (ppm) | 46.5 ± 12.5 | 19.9 ± 6.3 | 1.0 ± 0.9 | 41.3 ± 14.4 |
| Days ammonia > 1.5 ppm | 4.1 ± 1.9 | 0.0 ± 0.0 | 31.7 ± 28.0 | 0.0 ± 0.0 |
| Days ammonia > 2.0 ppm | 0.0 ± 0.0 | 0.0 ± 0.0 | 6.5 ± 7.3 | 0.0 ± 0.0 |

## 7. Zero-Death Rates

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Games with 0 fish deaths** | 99.9% | 100.0% | 53.0% | 100.0% |
| **Games with 0 plant deaths** | 100.0% | 74.4% | 3.7% | 83.1% |
| **Games ending below start ($1,000)** | 0.0% | 0.0% | 11.7% | 0.0% |

## 8. Fish Deaths — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 0 | 0 | 0 | 0 |
| **P25** | 0 | 0 | 0 | 0 |
| **Median** | 0 | 0 | 0 | 0 |
| **P75** | 0 | 0 | 27 | 0 |
| **P95** | 0 | 0 | 60 | 0 |
| **Max** | 3 | 0 | 120 | 0 |

## 9. Events and Repairs (mean ± σ)

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Events encountered per game | 6.35 ± 2.16 | 5.61 ± 2.06 | 7.56 ± 2.63 | 5.18 ± 1.88 |
| Repair actions per game | 2.61 ± 1.56 | 1.83 ± 1.32 | 3.90 ± 2.23 | 1.62 ± 1.16 |
| Biofilter units bought | 0.13 ± 0.34 | 0.00 ± 0.00 | 0.00 ± 0.00 | 0.00 ± 0.00 |
| First harvest day | 5.0 ± 0.0 | 5.0 ± 0.0 | 6.0 ± 0.0 | 5.0 ± 0.0 |
| Stable-ecosystem streak (final day count) | 1.9 ± 1.6 | 0.0 ± 0.0 | 0.0 ± 0.0 | 0.0 ± 0.0 |

| **Games with zero events** | 0.1% | 0.2% | 0.0% | 0.1% |

## 10. Events Encountered — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 3 | 2 | 3 | 2 |
| **P25** | 5 | 4 | 6 | 4 |
| **Median** | 6 | 6 | 7 | 5 |
| **P75** | 8 | 7 | 9 | 6 |
| **P95** | 10 | 9 | 12 | 8 |
| **Max** | 16 | 15 | 19 | 13 |

## 11. Repair Costs — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0 | 0 | 0 | 0 |
| **P5** | 0 | 0 | 50 | 0 |
| **P25** | 100 | 50 | 150 | 50 |
| **Median** | 150 | 125 | 225 | 100 |
| **P75** | 250 | 200 | 350 | 175 |
| **P95** | 375 | 325 | 525 | 275 |
| **Max** | 775 | 675 | 1050 | 725 |

## 12. Peak Ammonia — Percentile Distribution

| | Balanced | Conservative | Aggressive | Reactive |
|---|---|---|---|---|
| **Min** | 0.000 | 0.000 | 0.014 | 0.000 |
| **P5** | 1.160 | 0.265 | 1.246 | 0.220 |
| **P25** | 1.161 | 0.265 | 1.492 | 0.265 |
| **Median** | 1.328 | 0.310 | 2.864 | 0.265 |
| **P75** | 1.361 | 0.465 | 3.474 | 0.465 |
| **P95** | 1.544 | 0.498 | 3.778 | 0.498 |
| **Max** | 2.021 | 0.533 | 3.870 | 0.533 |

## 13. Derived Efficiency Metrics

| Metric | Balanced | Conservative | Aggressive | Reactive |
|--------|----------|-------------|-----------|---------|
| Revenue per fish death (games with deaths) | $1964 | N/A (0 deaths) | $189 | N/A (0 deaths) |
| Gross revenue per repair dollar | 14.7x | 10.3x | 9.9x | 8.2x |
| Events per day (avg) | 0.0635 | 0.0561 | 0.0756 | 0.0518 |
| Event repair rate (repairs/events) | 41.2% | 32.7% | 51.7% | 31.3% |
| Net profit per plant death (games with deaths) | $290.05 | $206.55 | $4.91 | $167.77 |

## 14. Head-to-Head Pairwise Comparisons

Probability that a randomly sampled game from Strategy A ends with more final money than a randomly sampled game from Strategy B (Monte Carlo, 1M random pairs):

| Matchup | P(A wins) | P(tie) | P(B wins) |
|---------|----------|--------|----------|
| **Balanced** vs Conservative | 52.9% | 0.0% | 47.1% |
| **Balanced** vs Aggressive | 55.3% | 0.0% | 44.7% |
| **Balanced** vs Reactive | 71.5% | 0.0% | 28.5% |
| **Conservative** vs Aggressive | 53.9% | 0.0% | 46.1% |
| **Conservative** vs Reactive | 68.9% | 0.0% | 31.1% |
| **Aggressive** vs Reactive | 56.8% | 0.0% | 43.2% |

## 15. Outcome Variance — Coefficient of Variation

CV = σ / mean × 100. Higher CV = more variable outcomes game-to-game.

| Metric | Balanced CV | Conservative CV | Aggressive CV | Reactive CV |
|--------|------------|----------------|--------------|------------|
| Final money | 21.0% | 21.3% | 48.1% | 24.2% |
| Gross revenue | 2.5% | 4.3% | 32.9% | 1.3% |
| Repair costs | 62.2% | 74.8% | 59.0% | 74.9% |
| Fish deaths | 4165.5% | N/A | 144.3% | N/A |
| Events | 34.0% | 36.7% | 34.9% | 36.2% |

## Notes

- All games run for exactly 100 days (time_limit outcome) except the rare games that reached the Thriving milestone ($5,000) before day 100.
- Starting money: $1,000. Net profit = final_money − $1,000.
- "Events encountered" includes all social (School Tour) and technical (pump failure, filter clog, water leak, disease, pH events) events.
- "Repair actions" counts only moves that invoked repairSystem or quickRepairSystem.
- Peak ammonia is the highest single-turn ammonia reading across the 100-day game.
- Head-to-head win rates use independent random sampling (1M pairs); ties are exact dollar matches (rare).
- Source data: `backend/simulation-results-100k.csv` (aggregates) and `backend/simulation-games-100k.csv` (per-game).

*Generated: 2026-06-24*