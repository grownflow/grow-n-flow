import React from 'react';

// What the player should do RIGHT NOW (before pressing Progress Day) for each event.
// Shown in the PendingEventCard so there's no ambiguity about timing.
const EVENT_ACTION_GUIDE = {
  pumpFailure:         'Save $50 for Quick Repair (or $100 for Full Repair). Check the Market for funds if needed.',
  filterClog:          'Save $25 for Quick Repair (or $50 for Full Repair). You can also apply a Biofilter unit to partially offset the efficiency drop.',
  waterLeak:           'Save $37 for Quick Repair (or $75 for Full Repair). The tank will lose 50 L per day until patched.',
  ammoniaSpike:        'Buy a Buffering Solution or Biofilter from the Market. Performing a Partial Water Change now will dilute the incoming spike.',
  nitriteSpike:        'Apply a Biofilter unit from your Inventory to boost processing. A Partial Water Change also helps.',
  lowDissolvedOxygen:  'Apply Aeration Stones from your Inventory, or buy them from the Market ($25/pack). Stop feeding until oxygen recovers.',
  fishDiseaseOutbreak: 'Stop feeding immediately to reduce ammonia. Perform a Partial Water Change to lower stress. Remove any dead fish.',
  plantDiseaseOutbreak:'Check nitrate and iron levels — add Chelated Iron if iron < 1 ppm. Harvesting mature plants now reduces disease spread.',
  pHCrash:             'Apply a Buffering Solution (Calcium Carbonate or Potassium Carbonate) from your Inventory to raise pH before the drop hits.',
};


const SEVERITY_CONFIG = {
  low: { color: '#28a745', bg: '#d4edda', border: '#c3e6cb', icon: 'ℹ️', label: 'Low' },
  medium: { color: '#ffc107', bg: '#fff3cd', border: '#ffeeba', icon: '⚠️', label: 'Medium' },
  high: { color: '#dc3545', bg: '#f8d7da', border: '#f5c6cb', icon: '🚨', label: 'High' },
};

const EventsPanel = ({ gameState, onRepair, onQuickRepair }) => {
  if (!gameState || !gameState.G) return null;

  const { G } = gameState;
  const activeEvent = G.activeEvent || null;
  const pendingEvent = G.pendingEvent || null;
  const eventHistory = G.eventHistory || [];

  // Show latest events first, limit to 3
  const recentHistory = [...eventHistory].reverse().slice(0, 3);

  return (
    <section className="events-panel">
      <h2>Events</h2>

      {/* Pending event — player still has time to act */}
      {pendingEvent && (
        <PendingEventCard event={pendingEvent} />
      )}

      {/* Active event currently affecting the system */}
      {activeEvent ? (
        <ActiveEventCard event={activeEvent} money={G.money} onRepair={onRepair} onQuickRepair={onQuickRepair} />
      ) : !pendingEvent && (
        <div className="no-active-event">
          <span className="no-event-icon">☀️</span>
          <span>All systems normal — no active events</span>
        </div>
      )}

      {/* Event History */}
      {recentHistory.length > 0 && (
        <div className="event-history">
          <h3>📜 Recent History</h3>
          <div className="event-history-list">
            {recentHistory.map((entry, i) => (
              <div key={i} className="event-history-item">
                <span className="event-history-id">{entry.eventId.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="event-history-day">Day {entry.triggeredAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const ActiveEventCard = ({ event, money, onRepair, onQuickRepair }) => {
  const severity          = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium;
  const canAffordRepair   = event.repairCost      ? money >= event.repairCost      : false;
  const canAffordQuick    = event.quickRepairCost ? money >= event.quickRepairCost : false;

  return (
    <div
      className="active-event-card"
      style={{
        background: severity.bg,
        borderColor: severity.border,
      }}
    >
      <div className="event-card-header">
        <span className="event-severity-badge" style={{ background: severity.color }}>
          {severity.icon} {severity.label}
        </span>
        <span className="event-turns-remaining">
          {event.turnsRemaining === 999
            ? '🔧 Until repaired'
            : `⏳ ${event.turnsRemaining} day${event.turnsRemaining !== 1 ? 's' : ''} left`}
        </span>
      </div>

      <div className="event-card-body">
        <h4 className="event-name">{event.name}</h4>
        <p className="event-description">{event.description}</p>
        {event.cause && (
          <p className="event-cause">
            <strong>Cause:</strong> {event.cause}
          </p>
        )}
      </div>

      {/* Effects list */}
      <div className="event-effects">
        {Object.entries(event.effects || {}).map(([key, value]) => (
          <span key={key} className="event-effect-tag">
            {formatEffectLabel(key)}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
          </span>
        ))}
      </div>

      {/* Repair options */}
      {event.repairCost != null && (
        <div className="event-repair">
          {/* Quick repair — cheaper, partial restoration */}
          {event.quickRepairCost != null && (
            <div className="repair-option" style={{ marginBottom: 6 }}>
              <button
                className={`btn-quick-repair ${canAffordQuick ? '' : 'btn-disabled'}`}
                onClick={onQuickRepair}
                disabled={!canAffordQuick}
                title="Emergency patch: ~70% restoration for half the cost. System may still be impaired."
              >
                ⚡ Quick Repair — ${event.quickRepairCost}
              </button>
              <span className="repair-note">~70% restoration · system may remain impaired</span>
            </div>
          )}

          {/* Full repair */}
          <div className="repair-option">
            <button
              className={`btn-repair ${canAffordRepair ? '' : 'btn-disabled'}`}
              onClick={onRepair}
              disabled={!canAffordRepair}
              title="Full repair: complete restoration to pre-event condition."
            >
              🔧 Full Repair — ${event.repairCost}
            </button>
            <span className="repair-note">100% restoration</span>
          </div>

          {!canAffordRepair && !canAffordQuick && (
            <span className="repair-insufficient">Not enough funds for either option</span>
          )}
        </div>
      )}
    </div>
  );
};

const PendingEventCard = ({ event }) => {
  const severity = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium;

  return (
    <div
      className="pending-event-card"
      style={{ borderColor: severity.border }}
    >
      <div className="event-card-header">
        <span className="pending-event-badge">
          Upcoming
        </span>
        <span className="event-severity-badge" style={{ background: severity.color }}>
          {severity.icon} {severity.label}
        </span>
      </div>

      <div className="event-card-body">
        <h4 className="event-name">{event.name}</h4>
        <p className="event-description">{event.description}</p>
        {event.cause && (
          <p className="event-cause"><strong>Cause:</strong> {event.cause}</p>
        )}
      </div>

      <div className="event-effects">
        {Object.entries(event.effects || {}).map(([key, value]) => (
          <span key={key} className="event-effect-tag">
            {formatEffectLabel(key)}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
          </span>
        ))}
      </div>

      <p className="pending-event-notice">
        Effects apply on your next Progress Day. You can still buy, repair, or apply
        items now without advancing time.
        {event.repairCost != null && ` Full repair will cost $${event.repairCost}.`}
      </p>
      {EVENT_ACTION_GUIDE[event.id] && (
        <p className="pending-event-action">
          <strong>Act now:</strong> {EVENT_ACTION_GUIDE[event.id]}
        </p>
      )}
    </div>
  );
};

function formatEffectLabel(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export default EventsPanel;
