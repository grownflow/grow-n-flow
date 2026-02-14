const WaterSection = ({gameState, loading}) => {

    if (!gameState) {
        return;
    }

    const { G, ctx } = gameState;
    
    return (
        <div>
            {/* Water Quality Section */}
        <section className="water-section">
          <h2>💧 Water Quality</h2>
          {G.aquaponicsSystem && G.aquaponicsSystem.tank && (
            <div className="water-stats">
              <div className="stat-item">
                <label>Ammonia:</label>
                <span className={G.aquaponicsSystem.tank.water.ammonia > 1 ? 'danger' : ''}>
                  {G.aquaponicsSystem.tank.water.ammonia.toFixed(2)} ppm
                </span>
              </div>
              <div className="stat-item">
                <label>Nitrite:</label>
                <span className={G.aquaponicsSystem.tank.water.nitrite > 0.5 ? 'warning' : ''}>
                  {G.aquaponicsSystem.tank.water.nitrite.toFixed(2)} ppm
                </span>
              </div>
              <div className="stat-item">
                <label>Nitrate:</label>
                <span className="good">
                  {G.aquaponicsSystem.tank.water.nitrate.toFixed(2)} ppm
                </span>
              </div>
              <div className="stat-item">
                <label>pH:</label>
                <span>{G.aquaponicsSystem.tank.water.pH.toFixed(1)}</span>
              </div>
              <div className="stat-item">
                <label>Temperature:</label>
                <span>{G.aquaponicsSystem.tank.water.temperature}°C</span>
              </div>
              <div className="stat-item">
                <label>Dissolved O₂:</label>
                <span>{G.aquaponicsSystem.tank.water.dissolvedOxygen} mg/L</span>
              </div>
            </div>
          )}
        </section>
        </div>
    )
}
export default WaterSection;