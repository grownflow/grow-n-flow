const FishTankSection = ({gameState, loading, handleHarvestPlant, handlePlantSeed}) => {

    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    
    return (
        <div>
            {/* Plants Section */}
            <section className="plants-section">
            <h2>🌱 Grow Beds</h2>
            <div className="plants-info">
                {G.plants && G.plants.length > 0 ? (
                <div className="plants-list">
                    {G.plants.map((plant) => (
                    <div key={plant.id} className="plant-item">
                        <span className="plant-type">{plant.cropType}</span>
                        <span className="plant-growth">📊 {plant.growthStage}</span>
                        <span className="plant-health">❤️ {plant.health}/10</span>
                        {plant.growthStage === 'mature' && (
                        <button 
                            onClick={() => handleHarvestPlant(plant.id)}
                            className="btn-harvest"
                            disabled={loading}
                        >
                            Harvest 🌾
                        </button>
                        )}
                    </div>
                    ))}
                </div>
                ) : (
                <p className="empty-message">No plants yet. Plant some seeds!</p>
                )}
            </div>
            
            <div className="action-buttons">
                <button 
                onClick={() => handlePlantSeed('Lettuce')} 
                disabled={loading}
                className="btn-primary"
                >
                Plant Lettuce 🥬
                </button>
                <button 
                onClick={() => handlePlantSeed('Tomato')} 
                disabled={loading}
                className="btn-primary"
                >
                Plant Tomato 🍅
                </button>
                <button 
                onClick={() => handlePlantSeed('Basil')} 
                disabled={loading}
                className="btn-primary"
                >
                Plant Basil 🌿
                </button>
            </div>
            </section>
        </div>
    )
}
export default FishTankSection;