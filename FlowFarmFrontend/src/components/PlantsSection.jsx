import { PLANT_SLOT_COUNT } from '../config/plantSlots';

const SPECIES_CATALOG = [
    { key: 'ParrisIslandRomaine', label: 'Romaine Lettuce',  icon: '🥬', seedCost: 0.30 },
    { key: 'Basil',               label: 'Basil',            icon: '🌿', seedCost: 0.25 },
    { key: 'Rosemary',            label: 'Rosemary',         icon: '🌱', seedCost: 0.50 },
    { key: 'Tomato',              label: 'Tomato',           icon: '🍅', seedCost: 0.60 },
    { key: 'Pepper',              label: 'Pepper',           icon: '🌶️', seedCost: 0.55 },
];

const PlantsSection = ({gameState, loading, handleHarvestPlant, handleHarvestAllMaturePlants, handlePlantSeed, handleBuyAllSeeds}) => {
    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    const maxPlantSlots = Math.max(G.maxPlantSlots || 0, PLANT_SLOT_COUNT);
    const openSlots = Math.max(0, maxPlantSlots - (G.plants?.length || 0));
    const bedFull = (G.plants && G.plants.length >= maxPlantSlots);

    const matureCount = (G.plants || []).filter((p) => p && p.growthStage === 'mature').length;
    const lastProgress = G.lastAction?.type === 'progressTurn' ? G.lastAction : null;
    const plantDeaths = Array.isArray(lastProgress?.plantDeaths) ? lastProgress.plantDeaths : [];

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

            {/* Per-species plant buttons */}
            <div className="species-plant-grid">
                {SPECIES_CATALOG.map(({ key, label, icon, seedCost }) => {
                    const affordableCount = Math.floor((G.money || 0) / seedCost);
                    const buyAllCount = Math.min(openSlots, affordableCount);
                    return (
                        <div key={key} className="species-plant-row">
                            <span className="species-label">{icon} {label} (${seedCost.toFixed(2)})</span>
                            <button
                                onClick={() => handlePlantSeed(key)}
                                disabled={loading || bedFull || (G.money || 0) < seedCost}
                                className="btn-primary btn-sm"
                            >
                                {bedFull ? `Bed Full (Max ${maxPlantSlots})` : 'Plant 1'}
                            </button>
                            <button
                                onClick={() => handleBuyAllSeeds(key, seedCost)}
                                disabled={loading || buyAllCount <= 0}
                                className="btn-secondary btn-sm"
                            >
                                {buyAllCount > 0 ? `Buy All (${buyAllCount})` : 'Buy All'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="action-buttons" style={{ marginTop: 8 }}>
                <button
                onClick={handleHarvestAllMaturePlants}
                disabled={loading || matureCount <= 0}
                className="btn-secondary"
                >
                {matureCount > 0
                    ? `Harvest All (${matureCount})`
                    : 'Harvest All'}
                </button>
            </div>

            <div className="plants-info">
                {plantDeaths.length > 0 && (
                    <div className="plants-warning" style={{ marginBottom: 10, padding: 10, background: '#fff4e5', border: '1px solid #ffdca8', borderRadius: 8 }}>
                        <strong>Plant losses:</strong>{' '}
                        {plantDeaths.map((d) =>
                          d?.reason ? `${d.type || 'plant'} (${d.reason})` : d?.type || 'plant'
                        ).join(', ')}
                    </div>
                )}
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
                            Harvest to Inventory 🌾
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