import React from 'react';

const SEVERITY_CONFIG = {
  low: { color: '#28a745', bg: '#d4edda', border: '#c3e6cb', icon: 'ℹ️', label: 'Low' },
  medium: { color: '#ffc107', bg: '#fff3cd', border: '#ffeeba', icon: '⚠️', label: 'Medium' },
  high: { color: '#dc3545', bg: '#f8d7da', border: '#f5c6cb', icon: '🚨', label: 'High' },
};

const EventsPanel = ({ gameState, onRepair }) => {
  if (!gameState || !gameState.G) return null;

  const { G } = gameState;
  const activeEvent = G.activeEvent || null;
  const eventHistory = G.eventHistory || [];

  // Show latest events first, limit to 3
  const recentHistory = [...eventHistory].reverse().slice(0, 3);

  return (
    <section className="events-panel">
      <h2>📰 Events</h2>

      {/* Active Event Banner */}
      {activeEvent ? (
        <ActiveEventCard event={activeEvent} money={G.money} onRepair={onRepair} />
      ) : (
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

const ActiveEventCard = ({ event, money, onRepair }) => {
  const severity = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium;
  const canAffordRepair = event.repairCost ? money >= event.repairCost : false;

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
            {formatEffectLabel(key)}: {formatEffectValue(value)}
          </span>
        ))}
      </div>

      {/* Suggested corrective actions */}
      {Array.isArray(event.correctiveActions) && event.correctiveActions.length > 0 && (
        <div className="event-corrective-actions">
          <div className="event-corrective-title">Suggested actions</div>
          <div className="event-corrective-list">
            {event.correctiveActions.slice(0, 5).map((a, idx) => (
              <div key={idx} className="event-corrective-item" title={a.equipmentType ? EQUIPMENT_TOOLTIPS[a.equipmentType] : undefined}>
                {formatCorrectiveAction(a)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repair button */}
      {event.repairCost != null && (
        <div className="event-repair">
          <button
            className={`btn-repair ${canAffordRepair ? '' : 'btn-disabled'}`}
            onClick={onRepair}
            disabled={!canAffordRepair}
          >
            🔧 Repair — ${event.repairCost}
          </button>
          {!canAffordRepair && (
            <span className="repair-insufficient">Not enough funds</span>
          )}
        </div>
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

function formatEffectValue(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Render nested objects like waterChemistryDeltaPerTurn.
    try {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      return entries.map(([k, v]) => `${formatEffectLabel(k)} ${v}`).join(', ');
    } catch (e) {
      return '[object]';
    }
  }
  return String(value);
}

const EQUIPMENT_TOOLTIPS = {
  biofilter: 'Biofilter — houses the bacteria colony that converts toxic ammonia/nitrite into plant-safe nitrate',
  waterPump: 'Water Pump — circulates water between the tank and grow beds, enabling biofilter function',
  airPump: 'Air Pump — raises dissolved oxygen; fish and bacteria both require it',
  growLight: 'Grow Light — provides light for plant photosynthesis',
  bufferingSolutionCalciumCarbonate: 'Calcium Carbonate — raises pH and replenishes calcium',
  bufferingSolutionPotassiumCarbonate: 'Potassium Carbonate — raises pH and replenishes potassium',
  chelatedIronDTPA11: 'Chelated Iron (DTPA 11%) — bioavailable iron supplement for plant chlorophyll production',
};

function formatCorrectiveAction(a) {
  if (!a || typeof a !== 'object') return '';
  const action = a.action || 'action';
  const parts = [action];
  if (a.equipmentType) parts.push(`(${a.equipmentType})`);
  if (a.fraction != null) parts.push(`${Math.round(Number(a.fraction) * 100)}%`);
  if (a.note) parts.push(`— ${a.note}`);
  return parts.join(' ');
}

export default EventsPanel;
