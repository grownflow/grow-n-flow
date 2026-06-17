#!/usr/bin/env node

/**
 * CLI tool to run batch simulations
 * Usage: node scripts/run-simulations.js [options]
 */

const { SimulationRunner } = require('../src/simulation/SimulationRunner');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  count: 10,
  strategies: ['balanced'],
  maxTurns: 365,
  verbose: false,
  output: null
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--count':
    case '-c':
      options.count = parseInt(args[++i]);
      break;
    case '--strategies':
    case '-s':
      options.strategies = args[++i].split(',');
      break;
    case '--max-turns':
    case '-t':
      options.maxTurns = parseInt(args[++i]);
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--output':
    case '-o':
      options.output = args[++i];
      break;
    case '--help':
    case '-h':
      printHelp();
      process.exit(0);
    default:
      if (args[i].startsWith('-')) {
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
      }
  }
}

function printHelp() {
  console.log(`
Aquaponics Game Simulation Runner

Usage: node scripts/run-simulations.js [options]

Options:
  -c, --count <number>          Number of games to simulate (default: 10)
  -s, --strategies <list>       Comma-separated list of strategies (default: balanced)
                                Available: conservative, aggressive, balanced, reactive
  -t, --max-turns <number>      Maximum days per game (default: 365)
  -v, --verbose                 Enable verbose output
  -o, --output <filename>       Output file for results (JSON format)
  -h, --help                    Show this help message

Examples:
  # 20-game quick sanity check (all 4 strategies, 60-day cap)
  npm run simulate:quick

  # 100-game full analysis, results saved to JSON
  npm run simulate:full

  # Custom run
  node scripts/run-simulations.js -c 50 -s conservative,balanced -t 100 -o results.json

  # Verbose single-strategy debug
  node scripts/run-simulations.js -c 3 -s aggressive -v
  `);
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   Aquaponics Simulation Runner v1.0      ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log('Configuration:');
  console.log(`  Games to run: ${options.count}`);
  console.log(`  Strategies: ${options.strategies.join(', ')}`);
  console.log(`  Max turns: ${options.maxTurns} days`);
  console.log(`  Verbose: ${options.verbose}`);
  if (options.output) {
    console.log(`  Output file: ${options.output}`);
  }

  // Create runner
  const runner = new SimulationRunner({
    maxTurns: options.maxTurns,
    verbose: options.verbose,
    batchSize: 100 // Process 100 games at a time
  });

  // Run simulations
  const startTime = Date.now();
  try {
    await runner.runBatch(options.count, options.strategies);
  } catch (error) {
    console.error('\n❌ Simulation failed:', error.message);
    process.exit(1);
  }
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  // Get statistics
  const stats = runner.getAggregateStats();

  // Print results
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║           SIMULATION RESULTS              ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  console.log(`Total Games: ${stats.totalGames}`);
  console.log(`Total Time: ${totalTime}s`);
  console.log(`Avg Time per Game: ${(totalTime / stats.totalGames).toFixed(2)}s`);
  console.log(`Avg Execution Time: ${stats.avgExecutionTimeMs}ms\n`);

  console.log('Overall outcomes:');
  Object.entries(stats.outcomes).forEach(([outcome, count]) => {
    const pct = ((count / stats.totalGames) * 100).toFixed(1);
    console.log(`  ${outcome.padEnd(15)}: ${String(count).padStart(4)} (${pct}%)`);
  });

  const fmt = {
    money:   (v) => v != null ? `$${Number(v).toFixed(2)}` : 'N/A',
    pct:     (v) => v != null ? `${v}%` : 'N/A',
    num:     (v) => v != null ? String(v) : 'N/A',
    ppm:     (v) => v != null ? `${Number(v).toFixed(3)} ppm` : 'N/A',
    day:     (v) => v != null ? String(v) : 'N/A',
  };

  console.log('\nBy Strategy:');
  Object.entries(stats.byStrategy).forEach(([strategy, s]) => {
    console.log(`\n  ${strategy.toUpperCase()} (n=${s.count}):`);
    console.log(`    Success rate     : ${fmt.pct(s.successRatePct)}`);
    console.log(`    Survival rate    : ${fmt.pct(s.survivalRatePct)}`);
    console.log(`    Avg days         : ${fmt.num(s.avgDays)}`);
    console.log(`    Avg final money  : ${fmt.money(s.avgFinalMoney)}`);
    console.log(`    Avg revenue      : ${fmt.money(s.avgRevenue)}`);
    console.log(`    Avg repair costs : ${fmt.money(s.avgRepairCosts)}`);
    console.log(`    Avg fish deaths  : ${fmt.num(s.avgFishDeaths)}`);
    console.log(`    Avg plant deaths : ${fmt.num(s.avgPlantDeaths)}`);
    console.log(`    Avg peak ammonia : ${fmt.ppm(s.avgPeakAmmonia)}`);
    console.log(`    Event repair rate: ${fmt.pct(s.eventRepairRatePct)}`);
    console.log(`    Biofilters bought: ${fmt.num(s.avgBiofiltersBought)}`);
    console.log(`    First harvest day: ${fmt.day(s.avgFirstHarvestDay)}`);
    if (s.milestonePct) {
      console.log(`    Milestone tiers reached:`);
      console.log(`      None (< $1500)       : ${s.milestonePct.none}%`);
      console.log(`      Established (≥ $1500): ${s.milestonePct.established}%`);
      console.log(`      Profitable  (≥ $2500): ${s.milestonePct.profitable}%`);
      console.log(`      Thriving    (≥ $5000): ${s.milestonePct.thriving}%`);
    }
    console.log(`    Outcomes:`);
    Object.entries(s.outcomes).forEach(([outcome, count]) => {
      const pct = ((count / s.count) * 100).toFixed(1);
      console.log(`      ${outcome.padEnd(13)}: ${String(count).padStart(3)} (${pct}%)`);
    });
  });

  // Export results if output specified
  if (options.output) {
    const outputPath = path.resolve(options.output);
    runner.exportResults(outputPath);
    console.log(`\n📊 Detailed results saved to: ${outputPath}`);
  }

  console.log('\n✅ Simulation complete!\n');
}

// Run main function
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
