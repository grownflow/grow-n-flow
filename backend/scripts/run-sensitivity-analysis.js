#!/usr/bin/env node
/**
 * Event-probability sensitivity analysis.
 *
 * For each technical event, sweeps its daily probability through
 *   base ± 10 percentage points  in 2-point increments (11 steps total).
 * All other events remain at their baseline probabilities.
 * This is a univariate sensitivity analysis — one event varied at a time.
 *
 * Outputs
 *   • Console: per-event tables + ranked sensitivity summary
 *   • <output>.json : full per-config data
 *   • <output>.csv  : one row per (event × delta) for spreadsheet analysis
 *
 * Usage
 *   node scripts/run-sensitivity-analysis.js [options]
 *
 * Options
 *   -n, --games <n>      Games per configuration (default: 100)
 *   -t, --max-turns <n>  Days per game (default: 100)
 *   -o, --output <stem>  Output file stem, no extension (default: sensitivity-results)
 *   -q, --quick          40 games/config instead of 100 (faster, noisier)
 *   -h, --help           Show this help
 *
 * Total games = (events tested) × (steps per event) × (games per config)
 * Default:          9          ×        11           ×       100        = 9,900 games
 * Quick  :          9          ×        11           ×        40        = 3,960 games
 */

'use strict';

const path = require('path');
const fs   = require('fs');

const { SimulationRunner } = require('../src/simulation/SimulationRunner');
const { EVENTS }           = require('../src/game/data/events');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const opts = {
  gamesPerConfig: 100,
  maxTurns:       100,
  outputStem:     'sensitivity-results',
  quick:          false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '-n': case '--games':     opts.gamesPerConfig = parseInt(args[++i], 10); break;
    case '-t': case '--max-turns': opts.maxTurns       = parseInt(args[++i], 10); break;
    case '-o': case '--output':    opts.outputStem     = args[++i];               break;
    case '-q': case '--quick':     opts.quick          = true;                    break;
    case '-h': case '--help':      printHelp(); process.exit(0);                  break;
    default:
      if (args[i].startsWith('-')) {
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
      }
  }
}

if (opts.quick) opts.gamesPerConfig = 40;

function printHelp() {
  console.log(`
Event-probability sensitivity analysis

Usage: node scripts/run-sensitivity-analysis.js [options]

Options:
  -n, --games <n>      Games per configuration (default: 100)
  -t, --max-turns <n>  Days per game (default: 100)
  -o, --output <stem>  Output file stem (default: sensitivity-results)
  -q, --quick          40 games/config for a fast exploratory run
  -h, --help           Show this help

Examples:
  # Full run — ~10k games, ~55 seconds
  node scripts/run-sensitivity-analysis.js

  # Quick exploration — ~4k games, ~22 seconds
  node scripts/run-sensitivity-analysis.js --quick

  # Custom games and output
  node scripts/run-sensitivity-analysis.js -n 200 -t 150 -o my-results
`);
}

// ─── Configuration ────────────────────────────────────────────────────────────

const STRATEGIES = ['conservative', 'aggressive', 'balanced', 'reactive'];

// Events to sweep.  testEvent (social money bonus) is excluded — it is not
// a challenge parameter and its variation would only show trivial money gains.
const EVENTS_TO_TEST = [
  'ammoniaSpike',
  'nitriteSpike',
  'lowDissolvedOxygen',
  'fishDiseaseOutbreak',
  'plantDiseaseOutbreak',
  'pHCrash',
  'waterLeak',
  'pumpFailure',
  'filterClog',
];

// ±10 percentage points in 2-point steps  (stored as decimal fractions)
const DELTA_STEPS = [-0.10, -0.08, -0.06, -0.04, -0.02, 0.00,
                      0.02,  0.04,  0.06,  0.08,  0.10];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Flatten aggregate stats into a single object that averages all
 * per-strategy metrics by game count (weighted average).
 */
function computeOverall(stats) {
  const strategies = Object.values(stats.byStrategy);
  const total = strategies.reduce((s, st) => s + st.count, 0);
  if (total === 0) return null;

  function wavg(key) {
    return strategies.reduce((s, st) => s + (st[key] ?? 0) * st.count, 0) / total;
  }
  function wavgNullable(key) {
    const valid = strategies.filter(st => st[key] != null);
    if (valid.length === 0) return null;
    const n = valid.reduce((s, st) => s + st.count, 0);
    return valid.reduce((s, st) => s + st[key] * st.count, 0) / n;
  }

  return {
    n:                  total,
    avgFinalMoney:      Math.round(wavg('avgFinalMoney')  * 100) / 100,
    avgRevenue:         Math.round(wavg('avgRevenue')     * 100) / 100,
    avgRepairCosts:     Math.round(wavg('avgRepairCosts') * 100) / 100,
    avgFishDeaths:      Math.round(wavg('avgFishDeaths')  * 10)  / 10,
    avgPlantDeaths:     Math.round(wavg('avgPlantDeaths') * 10)  / 10,
    avgPeakAmmonia:     wavgNullable('avgPeakAmmonia')   != null
      ? Math.round(wavgNullable('avgPeakAmmonia')  * 1000) / 1000 : null,
    eventRepairRatePct: wavgNullable('eventRepairRatePct') != null
      ? Math.round(wavgNullable('eventRepairRatePct')) : null,
    avgBiofiltersBought:Math.round(wavg('avgBiofiltersBought') * 10) / 10,
    avgFirstHarvestDay: wavgNullable('avgFirstHarvestDay') != null
      ? Math.round(wavgNullable('avgFirstHarvestDay') * 10) / 10 : null,
    successRatePct:     Math.round(wavg('successRatePct')),
    survivalRatePct:    Math.round(wavg('survivalRatePct')),
  };
}

/**
 * Compute the sensitivity slope: how much avgFinalMoney changes per
 * 1 percentage-point increase in event probability.
 * Uses a simple linear regression over all 11 data points.
 */
function computeSensitivitySlope(stepResults) {
  const points = stepResults
    .filter(r => r.overall != null)
    .map(r => ({ x: r.delta, y: r.overall.avgFinalMoney }));

  if (points.length < 2) return 0;

  const n  = points.length;
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx= points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy= points.reduce((s, p) => s + p.x * p.y, 0);

  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return 0;

  // slope in $/probability-unit; convert to $/percentage-point (÷100)
  const slopePerUnit = (n * sxy - sx * sy) / denom;
  return Math.round(slopePerUnit * 100) / 100 / 100; // $/pp
}

// ─── Core sweep ───────────────────────────────────────────────────────────────

async function runConfig(eventId, delta, gamesPerConfig, maxTurns) {
  const base    = EVENTS[eventId].probability;
  const testProb = clamp(base + delta, 0, 0.50);

  EVENTS[eventId].probability = testProb;
  try {
    const runner = new SimulationRunner({
      maxTurns,
      silent:    true,
      batchSize: Math.min(gamesPerConfig, 100),
    });
    await runner.runBatch(gamesPerConfig, STRATEGIES);
    const stats = runner.getAggregateStats();
    return { delta, testProb, overall: computeOverall(stats), byStrategy: stats.byStrategy };
  } finally {
    EVENTS[eventId].probability = base; // always restore, even on error
  }
}

// ─── Console output helpers ───────────────────────────────────────────────────

const HR = '─'.repeat(72);

function printEventTable(eventId, stepResults, baseProb) {
  const ev = EVENTS[eventId];
  console.log(`\n${HR}`);
  console.log(`EVENT: ${ev.name}  (base: ${(baseProb * 100).toFixed(1)}%)`);
  console.log(HR);

  const hdr = [
    'Delta'.padStart(6),
    'Prob'.padStart(6),
    'Avg Money'.padStart(11),
    'Revenue'.padStart(10),
    'Fish†'.padStart(7),
    'Plant†'.padStart(8),
    'Peak NH₃'.padStart(10),
    'Repair%'.padStart(9),
  ].join('  ');
  console.log(`  ${hdr}`);

  for (const r of stepResults) {
    const o   = r.overall;
    const tag = r.delta === 0 ? '◄' : ' ';
    const row = [
      `${r.delta >= 0 ? '+' : ''}${(r.delta * 100).toFixed(0)}%`.padStart(6),
      `${(r.testProb * 100).toFixed(1)}%`.padStart(6),
      (o ? `$${o.avgFinalMoney.toFixed(0)}` : 'ERR').padStart(11),
      (o ? `$${o.avgRevenue.toFixed(0)}`    : 'ERR').padStart(10),
      (o ? String(o.avgFishDeaths)          : 'ERR').padStart(7),
      (o ? String(o.avgPlantDeaths)         : 'ERR').padStart(8),
      (o ? `${o.avgPeakAmmonia != null ? o.avgPeakAmmonia.toFixed(3) : 'N/A'} ppm` : 'ERR').padStart(10),
      (o ? (o.eventRepairRatePct != null ? `${o.eventRepairRatePct}%` : 'N/A') : 'ERR').padStart(9),
    ].join('  ');
    console.log(`  ${row} ${tag}`);
  }
}

function printRankingTable(rankings) {
  console.log(`\n${'═'.repeat(72)}`);
  console.log('SENSITIVITY RANKING  ($ change in avg final money per +1 percentage-point)');
  console.log(`${'═'.repeat(72)}`);
  console.log(`  ${'Event'.padEnd(28)}  ${'Slope ($/pp)'.padStart(13)}  ${'Direction'.padEnd(12)}  Base prob`);
  console.log(`  ${'-'.repeat(28)}  ${'-'.repeat(13)}  ${'-'.repeat(12)}  ---------`);

  for (const r of rankings) {
    const arrow = r.slope < -1   ? '↓ hard impact'
                : r.slope < 0    ? '↓ soft impact'
                : r.slope < 1    ? '↑ mild benefit'
                :                  '↑ clear benefit';
    console.log(
      `  ${r.name.padEnd(28)}  ${String(r.slope.toFixed(2)).padStart(13)}  ${arrow.padEnd(12)}  ` +
      `${(r.baseProb * 100).toFixed(1)}%`
    );
  }
  console.log('');
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function buildCsvRows(allResults) {
  const header = [
    'event_id', 'event_name', 'event_type',
    'base_prob', 'delta', 'test_prob',
    'n_games',
    'avg_final_money', 'avg_revenue', 'avg_repair_costs',
    'avg_fish_deaths', 'avg_plant_deaths',
    'avg_peak_ammonia_ppm',
    'event_repair_rate_pct',
    'avg_biofilters_bought',
    'avg_first_harvest_day',
    'success_rate_pct', 'survival_rate_pct',
  ].join(',');

  const rows = [header];

  for (const { eventId, baseProb, stepResults } of allResults) {
    const ev = EVENTS[eventId];
    for (const r of stepResults) {
      const o = r.overall;
      rows.push([
        eventId,
        `"${ev.name}"`,
        ev.type,
        baseProb.toFixed(4),
        r.delta.toFixed(2),
        r.testProb.toFixed(4),
        o ? o.n : '',
        o ? o.avgFinalMoney  : '',
        o ? o.avgRevenue     : '',
        o ? o.avgRepairCosts : '',
        o ? o.avgFishDeaths  : '',
        o ? o.avgPlantDeaths : '',
        o ? (o.avgPeakAmmonia  ?? '') : '',
        o ? (o.eventRepairRatePct ?? '') : '',
        o ? o.avgBiofiltersBought : '',
        o ? (o.avgFirstHarvestDay ?? '') : '',
        o ? o.successRatePct  : '',
        o ? o.survivalRatePct : '',
      ].join(','));
    }
  }
  return rows.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const totalConfigs = EVENTS_TO_TEST.length * DELTA_STEPS.length;
  const totalGames   = totalConfigs * opts.gamesPerConfig;

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Aquaponics Event-Probability Sensitivity Analysis        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`  Events tested   : ${EVENTS_TO_TEST.length}`);
  console.log(`  Steps per event : ${DELTA_STEPS.length}  (${(DELTA_STEPS[0]*100).toFixed(0)}% to +${(DELTA_STEPS[DELTA_STEPS.length-1]*100).toFixed(0)}% in 2pp increments)`);
  console.log(`  Games per config: ${opts.gamesPerConfig}  (${STRATEGIES.length} strategies × ${opts.gamesPerConfig / STRATEGIES.length | 0} games each)`);
  console.log(`  Total games     : ${totalGames.toLocaleString()}`);
  console.log(`  Days cap/game   : ${opts.maxTurns}`);
  console.log(`  Output stem     : ${opts.outputStem}`);
  console.log('');

  const allResults = [];
  const rankings   = [];
  let configsDone  = 0;
  const wallStart  = Date.now();

  for (const eventId of EVENTS_TO_TEST) {
    const baseProb   = EVENTS[eventId].probability;
    const stepResults = [];

    for (const delta of DELTA_STEPS) {
      configsDone++;
      const testProb = clamp(baseProb + delta, 0, 0.50);
      const tag      = delta === 0 ? ' (baseline)' : '';
      process.stdout.write(
        `  [${String(configsDone).padStart(3)}/${totalConfigs}] ` +
        `${eventId.padEnd(22)} ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%pp → ` +
        `prob ${(testProb * 100).toFixed(1)}%${tag}  ...`
      );

      const t0 = Date.now();
      const result = await runConfig(eventId, delta, opts.gamesPerConfig, opts.maxTurns);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

      const o = result.overall;
      const moneyStr = o ? `$${o.avgFinalMoney.toFixed(0)}` : 'error';
      process.stdout.write(` done (${elapsed}s)  avg money: ${moneyStr}\n`);

      stepResults.push(result);
    }

    allResults.push({ eventId, baseProb, stepResults });

    // Compute slope for this event and add to rankings
    const slope = computeSensitivitySlope(stepResults);
    rankings.push({ eventId, name: EVENTS[eventId].name, baseProb, slope });

    // Print per-event table immediately
    printEventTable(eventId, stepResults, baseProb);
  }

  // Sort rankings by absolute slope (most sensitive first)
  rankings.sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope));
  printRankingTable(rankings);

  const wallSec = ((Date.now() - wallStart) / 1000).toFixed(1);
  console.log(`  Total wall time: ${wallSec}s for ${totalGames.toLocaleString()} games\n`);

  // ── Write JSON ──────────────────────────────────────────────────────────────
  const jsonPath = path.resolve(`${opts.outputStem}.json`);
  const jsonData = {
    meta: {
      timestamp:      new Date().toISOString(),
      eventsCount:    EVENTS_TO_TEST.length,
      deltaSteps:     DELTA_STEPS,
      gamesPerConfig: opts.gamesPerConfig,
      maxTurns:       opts.maxTurns,
      strategies:     STRATEGIES,
      totalGames,
    },
    rankings,
    results: allResults.map(({ eventId, baseProb, stepResults }) => ({
      eventId,
      eventName: EVENTS[eventId].name,
      eventType: EVENTS[eventId].type,
      baseProb,
      sensitivitySlope: rankings.find(r => r.eventId === eventId)?.slope,
      steps: stepResults.map(r => ({
        delta:    r.delta,
        testProb: r.testProb,
        overall:  r.overall,
      })),
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log(`  📄  JSON  → ${jsonPath}`);

  // ── Write CSV ───────────────────────────────────────────────────────────────
  const csvPath = path.resolve(`${opts.outputStem}.csv`);
  fs.writeFileSync(csvPath, buildCsvRows(allResults));
  console.log(`  📊  CSV   → ${csvPath}`);

  console.log('\n✅  Sensitivity analysis complete!\n');
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err);
  process.exit(1);
});
