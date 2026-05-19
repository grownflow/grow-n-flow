import { useState } from 'react';

const FishTankSection = ({gameState, loading, handleAddFish, handleSellFish, handleFeedFish, feedFishStatus}) => {

    const [feedAmount, setFeedAmount] = useState(10);

    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;

    const tank = G?.aquaponicsSystem?.tank;
    const water = tank?.water;
    const lastAction = G?.lastAction;
    const lastProgress = lastAction?.type === 'progressTurn' ? lastAction : null;

    const fishArray = Array.isArray(G.fish) ? G.fish : [];
    const rates = fishArray.map((f) => Number(f?.foodConsumptionRate)).filter((n) => Number.isFinite(n) && n > 0);
    const missingRateCount = fishArray.length - rates.length;
    const totalDailyNeed = rates.reduce((sum, n) => sum + n, 0);
    const minDailyToAvoidUnderfeed = totalDailyNeed * 0.8;
    const suggestedAddUnitsFull = Math.max(1, Math.ceil(totalDailyNeed || 0));
    const suggestedAddUnitsMin = Math.max(1, Math.ceil(minDailyToAvoidUnderfeed || 0));

    // Group fish by type for the summary
    const fishCounts = {};
    if (G.fish) {
        G.fish.forEach(f => {
            if (!fishCounts[f.type]) fishCounts[f.type] = 0;
            fishCounts[f.type]++;
        });
    }
    
    return (
        <div>
            <section className="fish-section">
            <h2>🐟 Fish Tank ({G.fish ? G.fish.length : 0})</h2>

            <div className="tank-info" style={{ marginTop: 8 }}>
                <p style={{ margin: 0 }}>
                    <strong>Fish food (inventory):</strong> {Math.floor(Number(G.fishFood) || 0)}
                </p>
                <p style={{ margin: 0 }}>
                    <strong>Tank food (in water):</strong> {Number(tank?.foodInTank ?? 0).toFixed(2)}
                </p>
                <p style={{ margin: 0 }}>
                    <strong>Tank sediment (waste):</strong> {Number(tank?.sediment ?? 0).toFixed(2)}
                </p>
                <p style={{ margin: 0 }}>
                    <strong>Water:</strong> Temp {Number(water?.temperature ?? 0).toFixed(2)}°C,{' '}
                    <span title="Ammonia — toxic fish waste. Above 0.5 ppm stresses fish.">NH₃</span> {Number(water?.ammonia ?? 0).toFixed(3)},{' '}
                    <span title="Dissolved oxygen. Fish need above 5 mg/L to thrive. Drops with high temperature or low aeration.">O₂</span> {Number(water?.dissolvedOxygen ?? 0).toFixed(2)}
                </p>
                <p style={{ margin: 0 }}>
                    <strong>Recommended food/day:</strong> {Number(totalDailyNeed || 0).toFixed(2)} units (full) / {Number(minDailyToAvoidUnderfeed || 0).toFixed(2)} units (min to avoid underfeeding)
                    {missingRateCount > 0 ? ` • ${missingRateCount} fish missing rate` : ''}
                </p>
                <p style={{ margin: 0 }}>
                    <strong>Suggested “Add Food” (whole units):</strong> {suggestedAddUnitsFull} (full) / {suggestedAddUnitsMin} (min)
                </p>
            </div>

            {lastProgress?.fishFeeding && (
                <div className="tank-info" style={{ marginTop: 8 }}>
                    <p style={{ margin: 0 }}>
                        <strong>Last day feeding:</strong> ate {Number(lastProgress.fishFeeding.totalEaten ?? 0).toFixed(2)} (tank {Number(lastProgress.fishFeeding.tankFoodBefore ?? 0).toFixed(2)} → {Number(lastProgress.fishFeeding.tankFoodAfter ?? 0).toFixed(2)}) | avg stress {Number(lastProgress.fishFeeding.avgStress ?? 0).toFixed(3)} | ΔHealth {Number(lastProgress.fishFeeding.totalHealthDelta ?? 0).toFixed(3)}
                    </p>
                    {Array.isArray(lastProgress.fishDeaths) && lastProgress.fishDeaths.length > 0 && (
                        <p style={{ margin: 0 }}>
                            <strong>Deaths:</strong> {lastProgress.fishDeaths.map((d) => d?.type || 'fish').join(', ')}
                        </p>
                    )}
                </div>
            )}

            {lastProgress?.fishFeedingDebug?.fish?.length > 0 && (
                <div className="tank-info" style={{ marginTop: 8 }}>
                    <p style={{ margin: 0 }}>
                        <strong>Debug (stress + feeding):</strong>
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                        {lastProgress.fishFeedingDebug.fish.map((f) => (
                            <div key={f.id || `${f.type}-${Math.random()}`} style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                    <span><strong>{f.type || 'fish'}</strong></span>
                                    <span>Health {Number(f?.health?.after ?? 0).toFixed(2)} ({Number(f?.health?.delta ?? 0).toFixed(2)})</span>
                                    <span>FoodRatio {Number(f?.foodRatio ?? 0).toFixed(2)} (portion {Number(f?.portion ?? 0).toFixed(2)} / need {Number(f?.requiredFood ?? 0).toFixed(2)})</span>
                                    <span>Stress {Number(f?.stress?.overall ?? 0).toFixed(3)} [T {Number(f?.stress?.temperature ?? 0).toFixed(3)} | NH3 {Number(f?.stress?.ammonia ?? 0).toFixed(3)} | O2 {Number(f?.stress?.oxygen ?? 0).toFixed(3)}]</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 13, color: '#333' }}>
                                    Thresholds: Temp {Number(f?.thresholds?.tempMin ?? 0)}–{Number(f?.thresholds?.tempMax ?? 0)} (opt {Number(f?.thresholds?.tempOptMin ?? 0)}–{Number(f?.thresholds?.tempOptMax ?? 0)}), NH3 tol {Number(f?.thresholds?.ammoniaToleranceMax ?? 0)}, O2 min {Number(f?.thresholds?.oxygenMin ?? 0)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary counts */}
            {Object.keys(fishCounts).length > 0 && (
                <div className="fish-summary">
                    {Object.entries(fishCounts).map(([type, count]) => (
                        <span key={type} className="fish-summary-tag">
                            {type}: {count}
                        </span>
                    ))}
                </div>
            )}

            <div className="tank-info">
                {G.fish && G.fish.length > 0 ? (
                <div className="fish-list">
                    {G.fish.map((fish) => (
                    <div key={fish.id} className="fish-item">
                        <span className="fish-type">{fish.type}</span>
                        <span className="fish-health">❤️ {fish.health}/10</span>
                        <span className="fish-age">🕐 {fish.age}d</span>
                        <span className="fish-weight">⚖️ {Math.round(fish.weight)}g / {fish.harvestWeight || 800}g</span>
                        <button 
                            className="btn-harvest"
                            disabled={fish.weight < (fish.harvestWeight || 800) * 0.8}
                            onClick={() => handleSellFish(fish.id)}
                            style={{marginLeft: 'auto', padding: '2px 8px'}}
                        >
                            Sell (${((fish.weight / 1000) * 2.20462 * fish.marketValue * (fish.health/10)).toFixed(2)}) 💰
                        </button>
                    </div>
                    ))}
                </div>
                ) : (
                <p className="empty-message">No fish yet. Add some to get started!</p>
                )}
            </div>
            
            <div className="action-buttons">
                <button 
                onClick={() => handleAddFish('tilapia', 1)} 
                disabled={loading}
                className="btn-primary"
                >
                Add Tilapia ($2.50) 🐟
                </button>
                <button 
                onClick={() => handleAddFish('barramundi', 1)} 
                disabled={loading}
                className="btn-primary"
                >
                Add Barramundi ($6.00) 🐠
                </button>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="number"
                        min={1}
                        step={1}
                        value={feedAmount}
                        onChange={(e) => setFeedAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        style={{ width: 90 }}
                        aria-label="Food amount"
                    />
                    <button 
                        onClick={() => handleFeedFish(feedAmount)} 
                        disabled={loading || Boolean(feedFishStatus?.pending)}
                        className="btn-secondary"
                    >
                        {feedFishStatus?.pending ? 'Adding…' : 'Add Food 🍞'}
                    </button>
                </div>
            </div>

                        {feedFishStatus?.message && (
                            <div className="tank-info feed-status" style={{ marginTop: 10, color: '#000' }}>
                                <p style={{ margin: 0 }}>
                                    <strong>{feedFishStatus?.ok === false ? 'Add food failed:' : 'Tank food:'}</strong> {feedFishStatus.message}
                                </p>
                            </div>
                        )}
            </section>
        </div>
    )
}
export default FishTankSection;