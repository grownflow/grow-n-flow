const FishTankSection = ({gameState, loading, handleAddFish, handleFeedFish}) => {

    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    
    return (
        <div>
            {/* Fish Tank Section */}
            <section className="fish-section">
            <h2>🐟 Fish Tank</h2>
            <div className="tank-info">
                {G.fish && G.fish.length > 0 ? (
                <div className="fish-list">
                    {G.fish.map((fishGroup, index) => (
                    <div key={index} className="fish-item">
                        <span className="fish-type">{fishGroup.type}</span>
                        <span className="fish-count">x{fishGroup.count}</span>
                        <span className="fish-health">❤️ {fishGroup.health}/10</span>
                        <span className="fish-age">Age: {fishGroup.age} days</span>
                    </div>
                    ))}
                </div>
                ) : (
                <p className="empty-message">No fish yet. Add some to get started!</p>
                )}
            </div>
            
            <div className="action-buttons">
                <button 
                onClick={() => handleAddFish('tilapia', 5)} 
                disabled={loading}
                className="btn-primary"
                >
                Add 5 Tilapia 🐟
                </button>
                <button 
                onClick={() => handleAddFish('goldfish', 3)} 
                disabled={loading}
                className="btn-primary"
                >
                Add 3 Goldfish 🐠
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