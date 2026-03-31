import { PLANT_SLOT_COUNT } from '../config/plantSlots';

const PlantsSection = ({gameState, loading, handleHarvestPlant, handlePlantSeed, handleBuyAllSeeds}) => {
    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    const maxPlantSlots = Math.max(G.maxPlantSlots || 0, PLANT_SLOT_COUNT);
    const openSlots = Math.max(0, maxPlantSlots - (G.plants?.length || 0));
    const seedCost = 0.3;
    const affordableCount = Math.floor((G.money || 0) / seedCost);
    const buyAllCount = Math.min(openSlots, affordableCount);

    // Group plants by type for summary
    const plantCounts = {};
    if (G.plants) {
        G.plants.forEach(p => {
            const label = formatPlantName(p.type);
            if (!plantCounts[label]) plantCounts[label] = 0;
            plantCounts[label]++;
        });
    }
    
    return (
        <div>
            <section className="plants-section">
            <h2>🌱 Grow Beds ({G.plants ? G.plants.length : 0})</h2>

            {/* Summary counts */}
            {Object.keys(plantCounts).length > 0 && (
                <div className="plants-summary">
                    {Object.entries(plantCounts).map(([name, count]) => (
                        <span key={name} className="plants-summary-tag">
                            {name}: {count}
                        </span>
                    ))}
                </div>
            )}

            <div className="action-buttons">
                <button 
                onClick={() => handlePlantSeed('ParrisIslandRomaine')} 
                disabled={loading || (G.plants && G.plants.length >= maxPlantSlots)}
                className="btn-primary"
                >
                {G.plants && G.plants.length >= maxPlantSlots 
                    ? `Bed Full (Max ${maxPlantSlots})` 
                    : "Plant Romaine Lettuce ($0.30) 🥬"
                }
                </button>
                <button
                onClick={() => handleBuyAllSeeds('ParrisIslandRomaine')}
                disabled={loading || buyAllCount <= 0}
                className="btn-secondary"
                >
                {buyAllCount > 0
                    ? `Buy All (${buyAllCount})`
                    : 'Buy All'}
                </button>
            </div>

            <div className="plants-info">
                {G.plants && G.plants.length > 0 ? (
                <div className="plants-list">
                    {G.plants.map((plant) => (
                    <div key={plant.id} className="plant-item">
                        <span className="plant-type">{formatPlantName(plant.type)}</span>
                        <span className="plant-growth">🌿 {plant.growthStage}</span>
                        <span className="plant-health">❤️ {plant.health}/10</span>
                        <span className="plant-age">🕐 {plant.age}d / {plant.growthDays}d</span>
                        {plant.growthStage === 'mature' && (
                        <button 
                            onClick={() => handleHarvestPlant(plant.id)}
                            className="btn-harvest"
                            disabled={loading}
                        >
                            Harvest (${plant.valuePerHead?.toFixed(2)}) 🌾
                        </button>
                        )}
                    </div>
                    ))}
                </div>
                ) : (
                <p className="empty-message">No plants yet. Plant some seeds!</p>
                )}
            </div>
            </section>
        </div>
    )
}

function formatPlantName(type) {
    // Convert camelCase/PascalCase to spaced words
    return type.replace(/([A-Z])/g, ' $1').trim();
}

export default PlantsSection;