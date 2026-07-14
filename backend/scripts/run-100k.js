#!/usr/bin/env node
/**
 * 100k simulation run — outputs JSON aggregate + three CSVs.
 *
 * Outputs (all in backend/):
 *   simulation-results-100k.json   — aggregate stats only (compact)
 *   simulation-results-100k.csv    — aggregate stats per strategy (4 rows)
 *   simulation-games-100k.csv      — per-game summary (100k rows)
 *   simulation-snapshots-100k.csv  — per-game 10-day snapshots (~1M rows)
 */

const path = require('path');
const fs   = require('fs');
const { SimulationRunner } = require('../src/simulation/SimulationRunner');

const OUT_DIR    = path.resolve(__dirname, '..');
const COUNT      = 100_000;
const STRATEGIES = ['conservative', 'aggressive', 'balanced', 'reactive'];
const MAX_TURNS  = 100;

// ── CSV helpers ───────────────────────────────────────────────────────────────

function csvRow(values) {
  return values.map(v => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(',') + '\n';
}

function writeCSV(filePath, headers, rows) {
  const fd = fs.openSync(filePath, 'w');
  fs.writeSync(fd, csvRow(headers));
  for (const row of rows) {
    fs.writeSync(fd, csvRow(headers.map(h => row[h])));
  }
  fs.closeSync(fd);
  console.log(`  ✓ ${path.basename(filePath)} (${rows.length.toLocaleString()} rows)`);
}

// ── Aggregate stats CSV ───────────────────────────────────────────────────────

function buildAggregateRows(aggregateStats, config) {
  const rows = [];
  for (const [strategy, s] of Object.entries(aggregateStats.byStrategy)) {
    const outcomesStr = Object.entries(s.outcomes)
      .map(([k, v]) => `${k}=${v}`)
      .join('|');

    rows.push({
      sourceFile:             'simulation-results-100k.json',
      timestamp:              new Date().toISOString(),
      totalGames:             aggregateStats.totalGames,
      config_maxTurns:        config.maxTurns,
      config_batchSize:       config.batchSize,
      strategy,
      count:                  s.count,
      outcomes:               outcomesStr,
      avgDays:                s.avgDays,
      avgFinalMoney:          s.avgFinalMoney,
      avgRevenue:             s.avgRevenue,
      avgRepairCosts:         s.avgRepairCosts,
      avgFishDeaths:          s.avgFishDeaths,
      avgPlantDeaths:         s.avgPlantDeaths,
      avgPeakAmmonia:         s.avgPeakAmmonia,
      avgBiofiltersBought:    s.avgBiofiltersBought,
      avgFirstHarvestDay:     s.avgFirstHarvestDay,
      successRatePct:         s.successRatePct,
      survivalRatePct:        s.survivalRatePct,
      eventRepairRatePct:     s.eventRepairRatePct,
      milestone_none:         s.milestonePct?.none,
      milestone_established:  s.milestonePct?.established,
      milestone_profitable:   s.milestonePct?.profitable,
      milestone_thriving:     s.milestonePct?.thriving,
      totalDays:              s._days,
      totalMoney:             s._money,
      totalRevenue:           s._revenue,
      totalRepairCosts:       s._repairCosts,
      totalFishDeaths:        s._fishDeaths,
      totalPlantDeaths:       s._plantDeaths,
      totalBiofiltersBought:  s._biofiltersBought,
      totalEventsEncountered: s._eventsEncountered,
      totalEventsRepaired:    s._eventsRepaired,
    });
  }
  return rows;
}

const AGG_HEADERS = [
  'sourceFile','timestamp','totalGames','config_maxTurns','config_batchSize',
  'strategy','count','outcomes',
  'avgDays','avgFinalMoney','avgRevenue','avgRepairCosts',
  'avgFishDeaths','avgPlantDeaths','avgPeakAmmonia','avgBiofiltersBought','avgFirstHarvestDay',
  'successRatePct','survivalRatePct','eventRepairRatePct',
  'milestone_none','milestone_established','milestone_profitable','milestone_thriving',
  'totalDays','totalMoney','totalRevenue','totalRepairCosts',
  'totalFishDeaths','totalPlantDeaths','totalBiofiltersBought',
  'totalEventsEncountered','totalEventsRepaired',
];

// ── Per-game summary CSV ──────────────────────────────────────────────────────

const GAME_HEADERS = [
  'gameId','strategy','outcome','outcomeReason','gameDays','executionTimeMs',
  // finalState
  'final_money','final_fishCount','final_plantCount','final_biofilterEfficiency',
  'final_ammonia','final_nitrate','final_dissolvedOxygen','final_fishFood',
  'final_highestMilestoneMoney','final_stableEcosystemDays',
  // analytics
  'moneyChange','netProfit','avgDailyProfit',
  // transactions
  'txn_fishPurchased','txn_plantsPurchased','txn_biofiltersBought',
  'txn_fishSold','txn_plantsSold',
  'txn_totalRevenue','txn_totalExpenses','txn_billsPaid','txn_repairCosts',
  // totals
  'tot_fishDeaths','tot_plantDeaths','tot_eventsEncountered','tot_eventsRepaired',
  'tot_peakAmmonia','tot_minDO','tot_daysWithHighAmmonia','tot_daysWithCriticalAmmonia',
  'tot_firstHarvestDay',
];

function gameRow(r) {
  const a  = r.analytics;
  const fs_ = r.finalState;
  const tx = a.transactions;
  const tt = a.totals;
  return {
    gameId:               r.gameId,
    strategy:             r.strategy,
    outcome:              r.outcome,
    outcomeReason:        r.outcomeReason,
    gameDays:             r.gameDays,
    executionTimeMs:      r.executionTimeMs,
    final_money:                fs_.money,
    final_fishCount:            fs_.fishCount,
    final_plantCount:           fs_.plantCount,
    final_biofilterEfficiency:  fs_.biofilterEfficiency,
    final_ammonia:              fs_.ammonia,
    final_nitrate:              fs_.nitrate,
    final_dissolvedOxygen:      fs_.dissolvedOxygen,
    final_fishFood:             fs_.fishFood,
    final_highestMilestoneMoney:fs_.highestMilestoneMoney,
    final_stableEcosystemDays:  fs_.stableEcosystemDays,
    moneyChange:          a.moneyChange,
    netProfit:            a.netProfit,
    avgDailyProfit:       a.avgDailyProfit,
    txn_fishPurchased:    tx.fishPurchased,
    txn_plantsPurchased:  tx.plantsPurchased,
    txn_biofiltersBought: tx.biofiltersBought,
    txn_fishSold:         tx.fishSold,
    txn_plantsSold:       tx.plantsSold,
    txn_totalRevenue:     tx.totalRevenue,
    txn_totalExpenses:    tx.totalExpenses,
    txn_billsPaid:        tx.billsPaid,
    txn_repairCosts:      tx.repairCosts,
    tot_fishDeaths:                tt.fishDeaths,
    tot_plantDeaths:               tt.plantDeaths,
    tot_eventsEncountered:         tt.eventsEncountered,
    tot_eventsRepaired:            tt.eventsRepaired,
    tot_peakAmmonia:               tt.peakAmmonia,
    tot_minDO:                     tt.minDO,
    tot_daysWithHighAmmonia:       tt.daysWithHighAmmonia,
    tot_daysWithCriticalAmmonia:   tt.daysWithCriticalAmmonia,
    tot_firstHarvestDay:           tt.firstHarvestDay,
  };
}

// ── Per-game timeline snapshots CSV ──────────────────────────────────────────

const SNAP_HEADERS = [
  'gameId','strategy','outcome',
  'day','money','fish','plants','avgFishHealth',
  'ammonia','nitrite','nitrate','dissolvedOxygen','pH',
  'biofilterEfficiency','fishFood','activeEvent',
];

function snapshotRows(r) {
  return (r.analytics.timeline || []).map(s => ({
    gameId:              r.gameId,
    strategy:            r.strategy,
    outcome:             r.outcome,
    day:                 s.day,
    money:               s.money,
    fish:                s.fish,
    plants:              s.plants,
    avgFishHealth:       s.avgFishHealth,
    ammonia:             s.ammonia,
    nitrite:             s.nitrite,
    nitrate:             s.nitrate,
    dissolvedOxygen:     s.dissolvedOxygen,
    pH:                  s.pH,
    biofilterEfficiency: s.biofilterEfficiency,
    fishFood:            s.fishFood,
    activeEvent:         s.activeEvent,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   100k Aquaponics Simulation → CSV Export    ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`  Games     : ${COUNT.toLocaleString()}`);
  console.log(`  Strategies: ${STRATEGIES.join(', ')}`);
  console.log(`  Max turns : ${MAX_TURNS} days\n`);

  const runner = new SimulationRunner({
    maxTurns:  MAX_TURNS,
    batchSize: 100,
    verbose:   false,
    silent:    false,
  });

  const t0 = Date.now();
  await runner.runBatch(COUNT, STRATEGIES);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n⏱  Simulation finished in ${elapsed}s`);
  console.log(`\n📝  Writing outputs to ${OUT_DIR}\n`);

  const aggregateStats = runner.getAggregateStats();

  // 1. JSON — aggregate stats only (compact, no 100k result objects)
  const jsonPath = path.join(OUT_DIR, 'simulation-results-100k.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    config:         runner.config,
    timestamp:      new Date().toISOString(),
    totalGames:     runner.results.length,
    aggregateStats,
  }, null, 2));
  console.log(`  ✓ simulation-results-100k.json`);

  // 2. Aggregate stats CSV (4 rows)
  writeCSV(
    path.join(OUT_DIR, 'simulation-results-100k.csv'),
    AGG_HEADERS,
    buildAggregateRows(aggregateStats, runner.config),
  );

  // 3. Per-game summary CSV (100k rows) — streamed to avoid string concat
  const gamesCsvPath = path.join(OUT_DIR, 'simulation-games-100k.csv');
  const gamesFd = fs.openSync(gamesCsvPath, 'w');
  fs.writeSync(gamesFd, csvRow(GAME_HEADERS));
  for (const r of runner.results) {
    fs.writeSync(gamesFd, csvRow(GAME_HEADERS.map(h => gameRow(r)[h])));
  }
  fs.closeSync(gamesFd);
  console.log(`  ✓ simulation-games-100k.csv (${runner.results.length.toLocaleString()} rows)`);

  // 4. Snapshots CSV (~1M rows) — streamed
  const snapCsvPath = path.join(OUT_DIR, 'simulation-snapshots-100k.csv');
  const snapFd = fs.openSync(snapCsvPath, 'w');
  fs.writeSync(snapFd, csvRow(SNAP_HEADERS));
  let totalSnaps = 0;
  for (const r of runner.results) {
    for (const snap of snapshotRows(r)) {
      fs.writeSync(snapFd, csvRow(SNAP_HEADERS.map(h => snap[h])));
      totalSnaps++;
    }
  }
  fs.closeSync(snapFd);
  console.log(`  ✓ simulation-snapshots-100k.csv (${totalSnaps.toLocaleString()} rows)`);

  // Print strategy summary
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║           AGGREGATE RESULTS                  ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  for (const [strat, s] of Object.entries(aggregateStats.byStrategy)) {
    console.log(`  ${strat.toUpperCase()} (n=${s.count.toLocaleString()})`);
    console.log(`    Avg final money : $${s.avgFinalMoney}`);
    console.log(`    Avg revenue     : $${s.avgRevenue}`);
    console.log(`    Success rate    : ${s.successRatePct}%`);
    console.log(`    Milestone none  : ${s.milestonePct?.none}%  established: ${s.milestonePct?.established}%  profitable: ${s.milestonePct?.profitable}%  thriving: ${s.milestonePct?.thriving}%`);
    console.log(`    Avg peak NH₃    : ${s.avgPeakAmmonia} ppm\n`);
  }

  console.log(`✅  All outputs written. Total time: ${elapsed}s\n`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
