import React, { useMemo } from 'react';
import gameAPI from '../services/gameAPI';

const InventoryPanel = ({ gameState, loading }) => {
  if (!gameState || !gameState.G) return null;

  const { G } = gameState;
  const produce = G.inventory?.produce || {};
  const equipment = G.equipment || {};

  const produceEntries = useMemo(() => {
    return Object.entries(produce)
      .map(([type, data]) => ({
        type,
        count: Number(data?.count || 0),
        unitPrice: Number(data?.unitPrice || 0),
      }))
      .filter((e) => e.count > 0)
      .sort((a, b) => a.type.localeCompare(b.type));
  }, [produce]);

  const equipmentEntries = useMemo(() => {
    return Object.entries(equipment)
      .map(([key, qty]) => ({ key, qty: Number(qty || 0) }))
      .filter((e) => e.qty > 0)
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [equipment]);

  const pretty = (key) => String(key || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

  const handleSellAll = async (type, count) => {
    if (!type || !count) return;
    try {
      await gameAPI.sellProducts(type, count);
    } catch (e) {
      console.warn('[InventoryPanel] sellProducts failed', e);
    }
  };

  return (
    <section className="inventory-panel">
      <h2>📦 Inventory</h2>

      <h3>Harvested Produce</h3>
      {produceEntries.length === 0 ? (
        <p className="empty-message">No harvested produce yet. Harvest plants to add items here.</p>
      ) : (
        <div className="inventory-list">
          {produceEntries.map((p) => (
            <div key={p.type} className="inventory-item">
              <div className="inventory-item-main">
                <div className="inventory-item-name">{pretty(p.type)}</div>
                <div className="inventory-item-meta">
                  <span>Qty: {p.count}</span>
                  <span>Unit: ${p.unitPrice.toFixed(2)}</span>
                  <span>Total: ${(p.unitPrice * p.count).toFixed(2)}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-harvest"
                disabled={loading || p.count <= 0}
                onClick={() => handleSellAll(p.type, p.count)}
                style={{ marginLeft: 'auto', padding: '2px 8px' }}
              >
                Sell All 💰
              </button>
            </div>
          ))}
        </div>
      )}

      <h3>Supplies & Equipment</h3>
      {equipmentEntries.length === 0 ? (
        <p className="empty-message">No equipment purchased yet.</p>
      ) : (
        <div className="inventory-list">
          {equipmentEntries.map((e) => (
            <div key={e.key} className="inventory-item">
              <div className="inventory-item-main">
                <div className="inventory-item-name">{pretty(e.key)}</div>
                <div className="inventory-item-meta">
                  <span>Qty: {e.qty}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default InventoryPanel;
