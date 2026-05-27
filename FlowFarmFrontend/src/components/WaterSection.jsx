import React, { useEffect, useMemo, useState } from 'react';
import gameAPI from '../services/gameAPI';
import soundManager from '../services/soundManager';

const DEFAULT_NH_SERIES = [
    { key: 'ammonia', className: 'ammonia', label: 'Ammonia' },
    { key: 'nitrite', className: 'nitrite', label: 'Nitrite' },
];
const DEFAULT_NO3_SERIES = [
    { key: 'nitrate', className: 'nitrate', label: 'Nitrate' },
];

const SUPPLEMENTS = [
    { key: 'biofilter',                          label: 'Biofilter',                      effect: 'Ammonia −1.5 ppm, Nitrite −0.8 ppm' },
    { key: 'bufferingSolutionCalciumCarbonate',  label: 'Buffering Solution (Calcium)',   effect: 'pH +0.2, Calcium +20 mg/L' },
    { key: 'bufferingSolutionPotassiumCarbonate', label: 'Buffering Solution (Potassium)', effect: 'pH +0.2, Potassium +20 mg/L' },
    { key: 'chelatedIronDTPA11',                 label: 'Chelated Iron (DTPA 11%)',        effect: 'Iron +1.0 mg/L' },
    { key: 'aerationStones',                     label: 'Aeration Stones',                effect: 'Dissolved O₂ +2.0 mg/L' },
];

const WaterSection = ({gameState, loading}) => {

    const [historyItems, setHistoryItems] = useState([]);
    const [applyingKey, setApplyingKey] = useState(null);
    const [historyError, setHistoryError] = useState(null);
    const [fixingDO, setFixingDO] = useState(false);
    const [fixingN, setFixingN] = useState(false);

    if (!gameState) {
        return;
    }

    const { G } = gameState;
    const tank = G.aquaponicsSystem?.tank;
    const water = tank?.water;

    useEffect(() => {
        if (!gameState?.G) return;

        let cancelled = false;
        (async () => {
            try {
                setHistoryError(null);
                const res = await gameAPI.getWaterHistory({ limit: 200 });
                if (cancelled) return;
                setHistoryItems(Array.isArray(res?.items) ? res.items : []);
            } catch (e) {
                if (cancelled) return;
                setHistoryError(e?.message || String(e));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [gameState?.G?.gameTime]);

    if (!tank || !water) {
        return (
            <div>
                <section className="water-section">
                    <h2>💧 Water Quality</h2>
                    <p className="empty-message">No tank data available.</p>
                </section>
            </div>
        );
    }

    const volumePercent = Math.round((tank.currentVolume / tank.capacity) * 100);

    const nitrogenHistory = useMemo(() => {
        // items: { gameTime, water: { ammonia, nitrite, nitrate, ... }, fishDeaths, plantDeaths }
        return (historyItems || [])
            .filter((it) => it && it.water)
            .map((it) => ({
                t: Number(it.gameTime ?? 0),
                ammonia: Number(it.water.ammonia ?? 0),
                nitrite: Number(it.water.nitrite ?? 0),
                nitrate: Number(it.water.nitrate ?? 0),
                fishDeaths: Number(it.fishDeaths ?? 0),
                plantDeaths: Number(it.plantDeaths ?? 0),
            }));
    }, [historyItems]);

    const equipment = G.equipment || {};
    const eventEffects = G.eventEffects || {};
    const systemAlerts = Array.isArray(G.systemAlerts) ? G.systemAlerts : [];
    const aerationStock = Number(equipment.aerationStones) || 0;
    const biofilterStock = Number(equipment.biofilter) || 0;
    const money = Number(G.money || 0);
    const lowOxygenActive = Number(water.dissolvedOxygen) < 5 || G.activeEvent?.id === 'lowDissolvedOxygen';
    const highNitrogenActive = Number(water.ammonia) > 0.5 || Number(water.nitrite) > 0.25
        || G.activeEvent?.id === 'ammoniaSpike' || G.activeEvent?.id === 'nitriteSpike'
        || G.activeEvent?.id === 'fishDiseaseOutbreak';
    const highNDanger = Number(water.ammonia) > 1.0 || Number(water.nitrite) > 0.5;

    const handleFixDO = async () => {
        if (fixingDO) return;
        setFixingDO(true);
        try {
            if (aerationStock === 0) {
                await gameAPI.buyEquipment('aerationStones', 1);
            }
            await gameAPI.applyConsumable('aerationStones');
            soundManager.play('consumable');
        } finally {
            setFixingDO(false);
        }
    };

    const handleFixN = async () => {
        if (fixingN) return;
        setFixingN(true);
        try {
            if (biofilterStock === 0) {
                await gameAPI.buyEquipment('biofilter', 1);
            }
            await gameAPI.applyConsumable('biofilter');
            soundManager.play('consumable');
        } finally {
            setFixingN(false);
        }
    };

    const handleApplySupplement = async (key) => {
        if (applyingKey) return;
        setApplyingKey(key);
        try {
            await gameAPI.applyConsumable(key);
            soundManager.play('consumable');
        } finally {
            setApplyingKey(null);
        }
    };

    return (
        <div>
            <section className="water-section">
                <h2>💧 Water Quality</h2>

                {Object.keys(eventEffects).length > 0 && (
                    <div className="water-issue-panel">
                        <h3>🔧 Active Event Effects</h3>
                        <div className="water-issue-tags">
                            {Object.entries(eventEffects).map(([key, value]) => (
                                <span key={key} className="event-effect-tag">
                                    {formatEffectLabel(key)}: {String(value)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {systemAlerts.length > 0 && (
                    <div className="water-issue-panel">
                        <h3>⚠️ System Alerts</h3>
                        <ul className="water-alert-list">
                            {systemAlerts.map((message, index) => (
                                <li key={index}>{message}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Tank Volume Bar */}
                <div className="tank-volume">
                    <div className="tank-volume-header">
                        <span>🪣 Tank Volume</span>
                        <span>{tank.currentVolume}L / {tank.capacity}L ({volumePercent}%)</span>
                    </div>
                    <div className="tank-volume-bar">
                        <div
                            className={`tank-volume-fill ${volumePercent < 30 ? 'danger' : volumePercent < 60 ? 'warning' : 'good'}`}
                            style={{ width: `${volumePercent}%` }}
                        />
                    </div>
                </div>

                {/* Trends Graph */}
                <h3 className="water-group-title">📈 Trends</h3>
                {historyError ? (
                    <p className="empty-message">Failed to load history: {historyError}</p>
                ) : (
                    <>
                        <WaterTrendChart
                            title="Ammonia & Nitrite (ppm)"
                            data={nitrogenHistory}
                            series={DEFAULT_NH_SERIES}
                            showDeaths={true}
                        />
                        <WaterTrendChart
                            title="Nitrate (ppm)"
                            data={nitrogenHistory}
                            series={DEFAULT_NO3_SERIES}
                        />
                    </>
                )}

                {/* Nitrogen Cycle */}
                <h3 className="water-group-title">🔄 Nitrogen Cycle</h3>
                <div className="water-stats">
                    <WaterStat
                        label="Ammonia (NH₃)"
                        value={water.ammonia}
                        unit="ppm"
                        decimals={2}
                        thresholds={{ warning: 0.5, danger: 1.0 }}
                        idealLabel="< 0.5"
                    />
                    <WaterStat
                        label="Nitrite (NO₂)"
                        value={water.nitrite}
                        unit="ppm"
                        decimals={2}
                        thresholds={{ warning: 0.25, danger: 0.5 }}
                        idealLabel="< 0.25"
                    />
                    <WaterStat
                        label="Nitrate (NO₃)"
                        value={water.nitrate}
                        unit="ppm"
                        decimals={2}
                        rangeWarning={{ low: 5, high: 80 }}
                        rangeDanger={{ low: 1 }}
                        idealLabel="5–80"
                    />
                </div>

                {/* High Nitrogen Quick Fix */}
                {highNitrogenActive && (
                    <div className={`high-n-alert ${highNDanger ? 'danger' : 'warning'}`}>
                        <div className="high-n-text">
                            <strong>⚠️ Elevated Ammonia / Nitrite</strong>
                            <span>
                                NH₃ {Number(water.ammonia).toFixed(2)} ppm · NO₂ {Number(water.nitrite).toFixed(2)} ppm
                            </span>
                        </div>
                        <button
                            type="button"
                            className="btn-fix-n"
                            disabled={loading || fixingN || (biofilterStock === 0 && money < 120)}
                            onClick={handleFixN}
                            title={biofilterStock > 0 ? `Apply biofilter (${biofilterStock} in stock)` : `Buy a biofilter for $120, then apply`}
                        >
                            {fixingN
                                ? 'Applying…'
                                : biofilterStock > 0
                                    ? `Apply Biofilter (${biofilterStock} left)`
                                    : money >= 120
                                        ? 'Buy Biofilter & Apply ($120)'
                                        : 'Need $120 or a biofilter'}
                        </button>
                    </div>
                )}

                {/* Core Parameters */}
                <h3 className="water-group-title">🌡️ Core Parameters</h3>
                <div className="water-stats">
                    <WaterStat
                        label="pH"
                        value={water.pH}
                        unit=""
                        decimals={1}
                        rangeWarning={{ low: 6.5, high: 7.5 }}
                        rangeDanger={{ low: 6.2, high: 7.8 }}
                        idealLabel="6.5–7.5"
                    />
                    <WaterStat
                        label="Temperature"
                        value={water.temperature}
                        unit="°C"
                        decimals={1}
                        rangeWarning={{ low: 18, high: 30 }}
                        idealLabel="18–30"
                    />
                    <WaterStat
                        label="Dissolved O₂"
                        value={water.dissolvedOxygen}
                        unit="mg/L"
                        decimals={1}
                        thresholds={{ danger: 3, warning: 5 }}
                        idealLabel="> 5"
                        invertWarning
                    />
                </div>

                {/* Low-Oxygen Quick Fix */}
                {lowOxygenActive && (
                    <div className={`low-do-alert ${Number(water.dissolvedOxygen) < 3 ? 'danger' : 'warning'}`}>
                        <div className="low-do-text">
                            <strong>⚠️ Low Dissolved Oxygen</strong>
                            <span>{Number(water.dissolvedOxygen).toFixed(1)} mg/L — target &gt; 5 mg/L</span>
                        </div>
                        <button
                            type="button"
                            className="btn-fix-do"
                            disabled={loading || fixingDO || (aerationStock === 0 && money < 25)}
                            onClick={handleFixDO}
                            title={aerationStock > 0 ? `Apply one aeration stone (${aerationStock} in stock)` : `Buy a pack of 10 for $25, then apply one`}
                        >
                            {fixingDO
                                ? 'Applying…'
                                : aerationStock > 0
                                    ? `Apply Stone (${aerationStock} left)`
                                    : money >= 25
                                        ? 'Buy Pack & Apply ($25)'
                                        : `Need $25 or stones`}
                        </button>
                    </div>
                )}

                {/* Plant Nutrients */}
                <h3 className="water-group-title">🌱 Plant Nutrients</h3>
                <div className="water-stats">
                    <WaterStat label="Phosphorus" value={water.phosphorus} unit="mg/L" decimals={1} thresholds={{ warning: 5, danger: 2 }} idealLabel="> 5" invertWarning />
                    <WaterStat label="Potassium" value={water.potassium} unit="mg/L" decimals={1} thresholds={{ warning: 50, danger: 30 }} idealLabel="> 50" invertWarning />
                    <WaterStat label="Calcium" value={water.calcium} unit="mg/L" decimals={1} idealLabel="≥ 50" />
                    <WaterStat label="Magnesium" value={water.magnesium} unit="mg/L" decimals={1} idealLabel="≥ 15" />
                    <WaterStat label="Iron" value={water.iron} unit="mg/L" decimals={2} thresholds={{ warning: 1.5, danger: 1.0 }} idealLabel="> 1.5" invertWarning />
                </div>

                {/* Supplements */}
                <h3 className="water-group-title">🧪 Supplements</h3>
                <div className="supplement-list">
                    {SUPPLEMENTS.map(({ key, label, effect }) => {
                        const stock = Number(equipment[key]) || 0;
                        const busy = applyingKey === key;
                        return (
                            <div key={key} className="supplement-item">
                                <div className="supplement-info">
                                    <span className="supplement-label">{label}</span>
                                    <span className="supplement-effect">{effect}</span>
                                </div>
                                <div className="supplement-controls">
                                    <span className={`supplement-stock ${stock === 0 ? 'danger' : 'good'}`}>
                                        {stock} in stock
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-apply-supplement"
                                        disabled={stock === 0 || loading || busy}
                                        onClick={() => handleApplySupplement(key)}
                                    >
                                        {busy ? 'Applying…' : 'Apply 1'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Light Status */}
                {G.aquaponicsSystem?.light && (
                    <>
                        <h3 className="water-group-title">💡 Lighting</h3>
                        <div className="water-stats">
                            <div className="stat-item">
                                <label>Status</label>
                                <span className={G.aquaponicsSystem.light.isOn ? 'good' : 'danger'}>
                                    {G.aquaponicsSystem.light.isOn ? '🟢 ON' : '🔴 OFF'}
                                </span>
                            </div>
                            <div className="stat-item">
                                <label>Intensity</label>
                                <span>{G.aquaponicsSystem.light.intensity}%</span>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
};

const WaterTrendChart = ({ title, data, series = DEFAULT_NH_SERIES, showDeaths = false }) => {
    const width = 100;
    const height = 40;
    const pad = 4;

    const safeData = Array.isArray(data) ? data : [];

    if (safeData.length < 2) {
        return (
            <div className="water-chart-shell">
                <div className="water-chart-title">{title}</div>
                <p className="empty-message">Not enough history yet. Progress a few days.</p>
            </div>
        );
    }

    const allValues = [];
    safeData.forEach((d) => {
        series.forEach((s) => allValues.push(d[s.key]));
    });
    const maxY = Math.max(0.01, ...allValues.filter((n) => Number.isFinite(n)));
    const minY = 0;

    const xForIndex = (i) => {
        const denom = Math.max(1, safeData.length - 1);
        return pad + ((width - pad * 2) * i) / denom;
    };

    const yForValue = (v) => {
        const value = Number.isFinite(v) ? v : 0;
        const denom = Math.max(0.000001, maxY - minY);
        const pct = (value - minY) / denom;
        const y = pad + (height - pad * 2) * (1 - pct);
        return Math.max(pad, Math.min(height - pad, y));
    };

    const toPolyline = (key) => safeData.map((d, i) => `${xForIndex(i)},${yForValue(d[key])}`).join(' ');

    const last = safeData[safeData.length - 1];
    const first = safeData[0];
    const xLabel = `${first.t} → ${last.t} days`;

    const deathMarkers = showDeaths ? safeData.flatMap((d, i) => {
        const x = xForIndex(i);
        const markers = [];
        if (d.fishDeaths > 0) {
            markers.push({ x, y: height - pad - 3, color: '#d9534f', label: `Fish deaths: ${d.fishDeaths}`, day: d.t });
        }
        if (d.plantDeaths > 0) {
            markers.push({ x, y: height - pad - 9, color: '#5cb85c', label: `Plant deaths: ${d.plantDeaths}`, day: d.t });
        }
        return markers;
    }) : [];

    return (
        <div className="water-chart-shell">
            <div className="water-chart-title">{title}</div>
            <div className="water-chart-subtitle">{xLabel}</div>
            <svg className="water-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
                <rect x="0" y="0" width={width} height={height} className="water-chart-bg" />
                <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="water-chart-axis" />
                <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="water-chart-axis" />

                {series.map((s) => (
                    <polyline key={s.key} points={toPolyline(s.key)} className={`water-chart-line ${s.className}`} />
                ))}
                {deathMarkers.map((marker, index) => (
                    <g key={`death-${marker.day}-${index}`}>
                        <line
                            x1={marker.x} y1={pad}
                            x2={marker.x} y2={height - pad}
                            stroke={marker.color}
                            strokeWidth="0.6"
                            strokeDasharray="1.5,1.5"
                            opacity="0.45"
                        />
                        <circle cx={marker.x} cy={marker.y} r={3} fill={marker.color} opacity="0.95">
                            <title>{`Day ${marker.day} — ${marker.label}`}</title>
                        </circle>
                    </g>
                ))}
            </svg>
            <div className="water-chart-legend" aria-hidden="true">
                {series.map((s) => (
                    <span key={s.key} className={`legend-item ${s.className}`}>{s.label}</span>
                ))}
                {showDeaths && <span className="legend-item fish-deaths">Fish deaths</span>}
                {showDeaths && <span className="legend-item plant-deaths">Plant deaths</span>}
            </div>
        </div>
    );
};

const WaterStat = ({ label, value, unit, decimals = 2, thresholds, rangeWarning, rangeDanger, idealLabel, invertWarning }) => {
    let statusClass = '';

    if (thresholds && !invertWarning) {
        // Higher is worse (ammonia, nitrite)
        if (value >= thresholds.danger) statusClass = 'danger';
        else if (value >= thresholds.warning) statusClass = 'warning';
        else statusClass = 'good';
    } else if (thresholds && invertWarning) {
        // Lower is worse (dissolved oxygen, iron)
        if (value <= thresholds.danger) statusClass = 'danger';
        else if (value <= thresholds.warning) statusClass = 'warning';
        else statusClass = 'good';
    } else if (rangeWarning) {
        // Outside range is problematic (pH, temperature, nitrate)
        const belowDanger = rangeDanger?.low != null && value < rangeDanger.low;
        const aboveDanger = rangeDanger?.high != null && value > rangeDanger.high;
        if (belowDanger || aboveDanger) statusClass = 'danger';
        else if (value < rangeWarning.low || value > rangeWarning.high) statusClass = 'warning';
        else statusClass = 'good';
    }

    const displayValue = typeof value === 'number' ? value.toFixed(decimals) : value;

    return (
        <div className={`stat-item${statusClass ? ` stat-${statusClass}` : ''}`}>
            <label>{label}</label>
            <span className={statusClass}>
                {displayValue} {unit}
            </span>
            {idealLabel && <span className="stat-ideal">Ideal: {idealLabel}</span>}
        </div>
    );
};

function formatEffectLabel(key) {
    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

export default WaterSection;
