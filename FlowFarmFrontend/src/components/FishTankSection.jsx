const FishTankSection = ({gameState, loading, handleAddFish, handleSellFish, handleFeedFish}) => {

    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;

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
                <button 
                onClick={handleFeedFish} 
                disabled={loading || !G.fish || G.fish.length === 0}
                className="btn-secondary"
                >
                Feed Fish 🍞
                </button>
            </div>
            </section>
        </div>
    )
}
export default FishTankSection;