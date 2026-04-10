import React, { useEffect, useMemo, useState } from 'react';
import gameAPI from '../services/gameAPI';

const WaterSection = ({gameState, loading}) => {

    const [historyItems, setHistoryItems] = useState([]);
    const [historyError, setHistoryError] = useState(null);

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
        // items: { gameTime, water: { ammonia, nitrite, nitrate, ... } }
        return (historyItems || [])
            .filter((it) => it && it.water)
            .map((it) => ({
                t: Number(it.gameTime ?? 0),
                ammonia: Number(it.water.ammonia ?? 0),
                nitrite: Number(it.water.nitrite ?? 0),
                nitrate: Number(it.water.nitrate ?? 0),
            }));
    }, [historyItems]);

    return (
        <div>
            <section className="water-section">
                <h2>💧 Water Quality</h2>

                <div className="wip-notice">
                    <span className="wip-icon">🚧</span>
                    <p>
                        <strong>Work in Progress:</strong> Water chemistry simulation is currently under development. 
                        We are following research literature to model the nitrogen cycle, nutrient dynamics, and 
                        water parameter interactions with fidelity. Values shown are real game state but the 
                        underlying simulation logic is still being refined.
                    </p>
                </div>

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
                    <WaterTrendChart
                        title="Nitrogen Cycle (ppm)"
                        data={nitrogenHistory}
                    />
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
                        thresholds={{ warning: 150, danger: 200 }}
                        idealLabel="5–150"
                        invertWarning
                    />
                </div>

                {/* Core Parameters */}
                <h3 className="water-group-title">🌡️ Core Parameters</h3>
                <div className="water-stats">
                    <WaterStat
                        label="pH"
                        value={water.pH}
                        unit=""
                        decimals={1}
                        rangeWarning={{ low: 6.0, high: 7.5 }}
                        idealLabel="6.0–7.5"
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

                {/* Plant Nutrients */}
                <h3 className="water-group-title">🌱 Plant Nutrients</h3>
                <div className="water-stats">
                    <WaterStat label="Phosphorus" value={water.phosphorus} unit="mg/L" decimals={1} idealLabel="≥ 3" />
                    <WaterStat label="Potassium" value={water.potassium} unit="mg/L" decimals={1} idealLabel="≥ 30" />
                    <WaterStat label="Calcium" value={water.calcium} unit="mg/L" decimals={1} idealLabel="≥ 50" />
                    <WaterStat label="Magnesium" value={water.magnesium} unit="mg/L" decimals={1} idealLabel="≥ 15" />
                    <WaterStat label="Iron" value={water.iron} unit="mg/L" decimals={2} idealLabel="≥ 1" />
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

const WaterTrendChart = ({ title, data }) => {
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
        allValues.push(d.ammonia, d.nitrite, d.nitrate);
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

    return (
        <div className="water-chart-shell">
            <div className="water-chart-title">{title}</div>
            <div className="water-chart-subtitle">{xLabel}</div>
            <svg className="water-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
                <rect x="0" y="0" width={width} height={height} className="water-chart-bg" />
                <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="water-chart-axis" />
                <line x1={pad} y1={pad} x2={pad} y2={height - pad} className="water-chart-axis" />

                <polyline points={toPolyline('ammonia')} className="water-chart-line ammonia" />
                <polyline points={toPolyline('nitrite')} className="water-chart-line nitrite" />
                <polyline points={toPolyline('nitrate')} className="water-chart-line nitrate" />
            </svg>
            <div className="water-chart-legend" aria-hidden="true">
                <span className="legend-item ammonia">Ammonia</span>
                <span className="legend-item nitrite">Nitrite</span>
                <span className="legend-item nitrate">Nitrate</span>
            </div>
        </div>
    );
};

const WaterStat = ({ label, value, unit, decimals = 2, thresholds, rangeWarning, idealLabel, invertWarning }) => {
    let statusClass = '';

    if (thresholds && !invertWarning) {
        // Higher is worse (ammonia, nitrite)
        if (value >= thresholds.danger) statusClass = 'danger';
        else if (value >= thresholds.warning) statusClass = 'warning';
        else statusClass = 'good';
    } else if (thresholds && invertWarning) {
        // Lower is worse (dissolved oxygen, nitrate in useful range)
        if (value <= thresholds.danger) statusClass = 'danger';
        else if (value <= thresholds.warning) statusClass = 'warning';
        else statusClass = 'good';
    } else if (rangeWarning) {
        // Outside range is bad (pH, temperature)
        if (value < rangeWarning.low || value > rangeWarning.high) statusClass = 'warning';
        else statusClass = 'good';
    }

    const displayValue = typeof value === 'number' ? value.toFixed(decimals) : value;

    return (
        <div className="stat-item">
            <label>{label}</label>
            <span className={statusClass}>
                {displayValue} {unit}
            </span>
            {idealLabel && <span className="stat-ideal">Ideal: {idealLabel}</span>}
        </div>
    );
};

export default WaterSection;