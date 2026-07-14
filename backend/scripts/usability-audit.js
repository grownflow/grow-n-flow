/**
 * usability-audit.js
 *
 * 1000-game simulation that tracks:
 *   - Which events fire (frequency by event ID)
 *   - For permanent-damage events (pumpFailure, filterClog, waterLeak):
 *       whether the bot repaired it, how many days it ran unrepaired,
 *       and whether it went unrepaired for the entire game
 *   - Which moves the bots actually executed (coverage check vs. all registered moves)
 *   - Chemistry events: did water return to safe levels within 3 days?
 *   - Unaffordable-repair situations (bot wanted to repair but lacked cash)
 *
 * Run with: node backend/scripts/usability-audit.js
 */

'use strict';

const { AquaponicsGame } = require('../src/game/game');
const { createBot } = require('../src/simulation/BotStrategies');
const moves = require('../src/game/moves');

// ── Config ────────────────────────────────────────────────────────────────────

const STRATEGIES     = ['conservative', 'balanced', 'aggressive', 'reactive'];
const GAMES_PER_STRAT = 250;                 // 1000 total
const MAX_TURNS       = 100;
const MAX_ACTIONS_PER_DAY = 15;

const DAMAGE_EVENTS   = new Set(['pumpFailure', 'filterClog', 'waterLeak']);
const CHEMISTRY_EVENTS = new Set(['ammoniaSpike', 'nitriteSpike', 'lowDissolvedOxygen',
                                  'pHCrash', 'fishDiseaseOutbreak', 'plantDiseaseOutbreak']);
const SOCIAL_EVENTS   = new Set(['testEvent', 'schoolTour']);

// All move names exported from the moves index
const ALL_MOVE_NAMES = Object.keys(moves);

// ── Accumulators ──────────────────────────────────────────────────────────────

// events[eventId] = { fired, repaired, unrepairedGames, totalDaysUnrepaired,
//                     daysToRepair[], unaffordableCount, chemRecovery3Days }
const events = {};

// movesUsed[moveName] = count across all games
const movesUsed = {};
ALL_MOVE_NAMES.forEach(n => { movesUsed[n] = 0; });
movesUsed['progressTurn'] = 0;  // called by runner, not by bot

// Per-strategy move counts
const stratMoves = {};
STRATEGIES.forEach(s => {
  stratMoves[s] = {};
  ALL_MOVE_NAMES.forEach(n => { stratMoves[s][n] = 0; });
  stratMoves[s]['progressTurn'] = 0;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureEvent(id) {
  if (!events[id]) {
    events[id] = {
      fired: 0,
      repaired: 0,
      unrepairedGames: 0,
      totalDaysUnrepaired: 0,
      daysToRepair: [],
      unaffordableCount: 0,
      chemRecoveryOk: 0,      // chemistry back to safe < 3 days after event ends
      chemRecoveryFail: 0,
    };
  }
  return events[id];
}

function suppress(fn) {
  const noop = () => {};
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = noop; console.warn = noop;
  try { fn(); } finally {
    console.log = saved.log; console.warn = saved.warn;
  }
}

// ── Single game runner with audit instrumentation ─────────────────────────────

async function runAuditedGame(strategy) {
  const G   = AquaponicsGame.setup();
  const ctx = { currentPlayer: '0', turn: 1, numPlayers: 1,
                playOrder: ['0'], playOrderPos: 0 };
  const bot = createBot(strategy, { verbose: false });

  // Active-event tracking within this game
  // { eventId, firedDay, repairedDay|null, unaffordableTurns }
  let currentDamageTrack = null;

  // Chemistry event tracking (short-lived events)
  let currentChemTrack  = null;  // { eventId, endDay (when turnsRemaining hits 0) }

  while (G.gameTime < MAX_TURNS) {
    const dayBefore = G.gameTime;
    const activeEventBefore = G.activeEvent ? G.activeEvent.id : null;
    const pendingBefore     = G.pendingEvent ? G.pendingEvent.id : null;

    // Bot decision loop
    let actions = 0;
    while (actions < MAX_ACTIONS_PER_DAY) {
      const decision = await bot.makeDecision(G, ctx);
      if (!decision) break;

      // Record the move
      const mn = decision.moveName;
      if (movesUsed[mn] !== undefined) movesUsed[mn]++;
      else movesUsed[mn] = 1;
      if (stratMoves[strategy][mn] !== undefined) stratMoves[strategy][mn]++;
      else stratMoves[strategy][mn] = 1;

      // Execute move
      suppress(() => {
        if (typeof moves[mn] === 'function') {
          moves[mn]({ G, ctx }, ...decision.args);
        }
      });

      // Track repair actions for active damage events
      if ((mn === 'repairSystem' || mn === 'quickRepairSystem') &&
          currentDamageTrack && G.lastAction?.success) {
        currentDamageTrack.repairedDay = G.gameTime;
      }

      actions++;
    }

    // Advance time
    suppress(() => moves.progressTurn({ G, ctx }));
    movesUsed['progressTurn']++;
    stratMoves[strategy]['progressTurn']++;
    ctx.turn++;

    const day = G.gameTime;

    // ── New damage event detection ────────────────────────────────────────────
    // If a new active event appeared that is a damage event
    const activeNow = G.activeEvent ? G.activeEvent.id : null;
    if (activeNow && DAMAGE_EVENTS.has(activeNow) && activeNow !== activeEventBefore) {
      const rec = ensureEvent(activeNow);
      rec.fired++;
      currentDamageTrack = { eventId: activeNow, firedDay: day, repairedDay: null, unaffordableTurns: 0 };
    }

    // ── New chemistry event detection ─────────────────────────────────────────
    if (activeNow && CHEMISTRY_EVENTS.has(activeNow) && activeNow !== activeEventBefore) {
      const rec = ensureEvent(activeNow);
      rec.fired++;
      const duration = G.activeEvent?.duration ?? 1;
      currentChemTrack = { eventId: activeNow, endDay: day + duration };
    }

    // ── Social event detection ────────────────────────────────────────────────
    // Social events are applied immediately and clear the same turn
    if (activeNow && SOCIAL_EVENTS.has(activeNow) && activeNow !== activeEventBefore) {
      ensureEvent(activeNow).fired++;
    }
    // Also check pending → active promotion for social (they may have appeared as pending last turn)
    if (pendingBefore && SOCIAL_EVENTS.has(pendingBefore) && !activeNow) {
      // Social events are applied in applyEventEffects then cleared; count them via active tracking above
    }

    // ── Track unaffordable repairs for active damage events ───────────────────
    if (currentDamageTrack && !currentDamageTrack.repairedDay && G.activeEvent?.id === currentDamageTrack.eventId) {
      const repairCost = G.activeEvent.repairCost ?? 0;
      const quickCost  = G.activeEvent.quickRepairCost ?? repairCost;
      if (G.money < quickCost) {
        currentDamageTrack.unaffordableTurns++;
        ensureEvent(currentDamageTrack.eventId).unaffordableCount++;
      }
    }

    // ── Check if damage event just resolved (repaired or game ended this turn) ─
    if (currentDamageTrack && !G.activeEvent) {
      // Either repaired or cleared
      const rec = ensureEvent(currentDamageTrack.eventId);
      if (currentDamageTrack.repairedDay != null) {
        rec.repaired++;
        const daysOpen = currentDamageTrack.repairedDay - currentDamageTrack.firedDay + 1;
        rec.daysToRepair.push(daysOpen);
        rec.totalDaysUnrepaired += daysOpen;
      }
      currentDamageTrack = null;
    }

    // ── Check chemistry recovery ──────────────────────────────────────────────
    if (currentChemTrack && day >= currentChemTrack.endDay) {
      const rec = ensureEvent(currentChemTrack.eventId);
      const w = G.aquaponicsSystem?.tank?.water;
      let ok = true;
      switch (currentChemTrack.eventId) {
        case 'ammoniaSpike':
        case 'fishDiseaseOutbreak':
          ok = Number(w?.ammonia ?? 0) < 1.0; break;
        case 'nitriteSpike':
          ok = Number(w?.nitrite ?? 0) < 0.5; break;
        case 'lowDissolvedOxygen':
          ok = Number(w?.dissolvedOxygen ?? 8) >= 5; break;
        case 'pHCrash':
          ok = Number(w?.pH ?? 7) >= 6.2; break;
        case 'plantDiseaseOutbreak':
          ok = Number(w?.nitrate ?? 0) >= 3; break;
        default: ok = true;
      }
      if (ok) rec.chemRecoveryOk++;
      else     rec.chemRecoveryFail++;
      currentChemTrack = null;
    }

    // End condition checks
    if (Number(G.money) <= -500) break;
    if (Number(G.money) >= 5000) break;
  }

  // At end of game, close any still-open damage track
  if (currentDamageTrack) {
    const rec = ensureEvent(currentDamageTrack.eventId);
    if (!currentDamageTrack.repairedDay) {
      rec.unrepairedGames++;
      const daysOpen = G.gameTime - currentDamageTrack.firedDay + 1;
      rec.totalDaysUnrepaired += daysOpen;
    }
    // If repaired but game ended before we detected it above
    if (currentDamageTrack.repairedDay != null) {
      rec.repaired++;
      rec.daysToRepair.push(currentDamageTrack.repairedDay - currentDamageTrack.firedDay + 1);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const totalGames = STRATEGIES.length * GAMES_PER_STRAT;
  console.log(`\nGrow-n-Flow Usability Audit — ${totalGames} games (${GAMES_PER_STRAT} × ${STRATEGIES.length} strategies)\n`);

  for (const strategy of STRATEGIES) {
    process.stdout.write(`  Running ${GAMES_PER_STRAT} ${strategy} games...`);
    for (let i = 0; i < GAMES_PER_STRAT; i++) {
      await runAuditedGame(strategy);
      if ((i + 1) % 50 === 0) process.stdout.write(` ${i + 1}`);
    }
    console.log(' done');
  }

  // ── Report ────────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(70));
  console.log('  EVENT COVERAGE REPORT');
  console.log('═'.repeat(70));

  const allEventIds = Object.keys(events).sort();
  for (const id of allEventIds) {
    const rec = events[id];
    const avgPerGame = (rec.fired / totalGames).toFixed(2);
    const isDamage   = DAMAGE_EVENTS.has(id);
    const isChem     = CHEMISTRY_EVENTS.has(id);
    const isSocial   = SOCIAL_EVENTS.has(id);

    console.log(`\n  ${id}`);
    console.log(`    Fires: ${rec.fired} total / ${avgPerGame} per game`);

    if (isDamage) {
      const repairRate = rec.fired > 0 ? ((rec.repaired / rec.fired) * 100).toFixed(1) : 'N/A';
      const avgDays = rec.daysToRepair.length > 0
        ? (rec.daysToRepair.reduce((a, b) => a + b, 0) / rec.daysToRepair.length).toFixed(1) : 'N/A';
      console.log(`    Type: DAMAGE (lasts until repaired)`);
      console.log(`    Repaired: ${rec.repaired} / ${rec.fired}  (${repairRate}%)`);
      console.log(`    Unrepaired games: ${rec.unrepairedGames}`);
      console.log(`    Avg days to repair: ${avgDays}`);
      console.log(`    Turns bot couldn't afford repair: ${rec.unaffordableCount}`);
    } else if (isChem) {
      const total = rec.chemRecoveryOk + rec.chemRecoveryFail;
      const okPct = total > 0 ? ((rec.chemRecoveryOk / total) * 100).toFixed(1) : 'N/A';
      console.log(`    Type: CHEMISTRY (short duration, auto-expires)`);
      console.log(`    Recovered to safe levels: ${rec.chemRecoveryOk}/${total}  (${okPct}%)`);
    } else if (isSocial) {
      console.log(`    Type: SOCIAL (instant cash bonus, no fix required)`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  MOVE USAGE REPORT');
  console.log('═'.repeat(70));
  console.log('\n  All moves registered in the backend:\n');

  // Sort: used moves first, then unused
  const used   = ALL_MOVE_NAMES.filter(n => (movesUsed[n] || 0) > 0).sort();
  const unused = ALL_MOVE_NAMES.filter(n => (movesUsed[n] || 0) === 0).sort();

  console.log(`  ${'Move'.padEnd(40)} ${'Total'.padStart(8)}   By strategy`);
  console.log('  ' + '-'.repeat(68));

  for (const n of used) {
    const total = movesUsed[n] || 0;
    const byStrat = STRATEGIES.map(s => `${s[0].toUpperCase()}:${stratMoves[s][n]||0}`).join('  ');
    console.log(`  ${n.padEnd(40)} ${String(total).padStart(8)}   ${byStrat}`);
  }

  if (unused.length > 0) {
    console.log('\n  ⚠  MOVES NEVER CALLED BY ANY BOT:');
    for (const n of unused) {
      console.log(`       ${n}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  USABILITY GAPS SUMMARY');
  console.log('═'.repeat(70) + '\n');

  // Detect unrepaired-rate problems
  for (const id of allEventIds) {
    const rec = events[id];
    if (!DAMAGE_EVENTS.has(id)) continue;
    const repairRate = rec.fired > 0 ? rec.repaired / rec.fired : 1;
    if (repairRate < 0.7) {
      console.log(`  ⚠  ${id}: only ${(repairRate*100).toFixed(1)}% repair rate`
        + ` (${rec.unrepairedGames} games unresolved)`);
    }
    if (rec.unaffordableCount > 50) {
      const pct = (rec.unaffordableCount / totalGames).toFixed(1);
      console.log(`  ⚠  ${id}: bots couldn't afford repair ${rec.unaffordableCount} turns`
        + ` (${pct} turns/game avg)`);
    }
  }

  // Chemistry events with poor recovery
  for (const id of allEventIds) {
    const rec = events[id];
    if (!CHEMISTRY_EVENTS.has(id)) continue;
    const total = rec.chemRecoveryOk + rec.chemRecoveryFail;
    if (total < 5) continue;
    const okPct = rec.chemRecoveryOk / total;
    if (okPct < 0.7) {
      console.log(`  ⚠  ${id}: chemistry only recovered to safe levels in ${(okPct*100).toFixed(1)}% of events`);
    }
  }

  // Moves never used
  if (unused.length > 0) {
    console.log(`  ⚠  ${unused.length} move(s) never called: ${unused.join(', ')}`);
  }

  console.log('\n  Done.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
