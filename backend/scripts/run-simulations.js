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
                                Available: conservative, aggressive, balanced, random
  -t, --max-turns <number>      Maximum days per game (default: 365)
  -v, --verbose                 Enable verbose output
  -o, --output <filename>       Output file for results (JSON format)
  -h, --help                    Show this help message

Examples:
  # Run 10 balanced games
  node scripts/run-simulations.js

  # Run 100 games with all strategies
  node scripts/run-simulations.js -c 100 -s conservative,aggressive,balanced,random

  # Run 1000 games and save results
  node scripts/run-simulations.js -c 1000 -s balanced,aggressive -o results.json

  # Verbose mode for debugging
  node scripts/run-simulations.js -c 5 -v
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

  console.log('Outcomes:');
  Object.entries(stats.outcomes).forEach(([outcome, count]) => {
    const percentage = ((count / stats.totalGames) * 100).toFixed(1);
    console.log(`  ${outcome.padEnd(15)}: ${count.toString().padStart(4)} (${percentage}%)`);
  });

  console.log('\nBy Strategy:');
  Object.entries(stats.byStrategy).forEach(([strategy, data]) => {
    console.log(`\n  ${strategy.toUpperCase()}:`);
    console.log(`    Games: ${data.count}`);
    console.log(`    Avg Days: ${data.avgDays}`);
    console.log(`    Avg Money: $${data.avgMoney}`);
    console.log(`    Outcomes:`);
    Object.entries(data.outcomes).forEach(([outcome, count]) => {
      const percentage = ((count / data.count) * 100).toFixed(1);
      console.log(`      ${outcome.padEnd(13)}: ${count.toString().padStart(3)} (${percentage}%)`);
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
