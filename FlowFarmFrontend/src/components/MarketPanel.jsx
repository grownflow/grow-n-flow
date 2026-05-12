import React, { useEffect, useMemo, useState } from 'react';
import gameAPI from '../services/gameAPI';

const MarketPanel = ({ gameState, loading, matchId }) => {
  if (!gameState || !gameState.G) return null;

  const { G } = gameState;
  const money = Number(G.money || 0);
  const owned = G.equipment || {};

  const [catalog, setCatalog] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [busyKey, setBusyKey] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setFetchError(null);
      try {
        const res = await gameAPI.getEquipmentCatalog();
        const equipment = res?.G?.lastAction?.equipment;
        if (!equipment || typeof equipment !== 'object') {
          throw new Error('Failed to load equipment catalog');
        }

        if (!cancelled) {
          setCatalog(equipment);
        }
      } catch (e) {
        if (!cancelled) {
          setCatalog(null);
          setFetchError(e?.message || String(e));
        }
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const items = useMemo(() => {
    if (!catalog) return [];

    return Object.entries(catalog)
      .map(([key, data]) => ({
        key,
        cost: Number(data?.cost || 0),
        type: data?.type || 'unknown',
        description: data?.description || '',
        dailyElectricityCost: Number(data?.dailyElectricityCost || 0),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [catalog]);

  const pretty = (key) => String(key || '').replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();

  const getQty = (key) => {
    const q = Math.floor(Number(quantities[key] ?? 1) || 1);
    return Math.max(1, q);
  };

  const setQty = (key, value) => {
    const parsed = Math.floor(Number(value) || 1);
    setQuantities((prev) => ({ ...prev, [key]: Math.max(1, parsed) }));
  };

  const handleBuy = async (key) => {
    if (!key) return;
    const qty = getQty(key);

    setBusyKey(key);
    try {
      const res = await gameAPI.buyEquipment(key, qty);
      if (res?.error) {
        console.warn('[MarketPanel] buyEquipment failed:', res.error);
      }
    } catch (e) {
      console.warn('[MarketPanel] buyEquipment failed:', e);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="inventory-panel market-panel">
      <h2>🛒 Market</h2>

      <div className="tank-info">
        <p style={{ margin: 0 }}>
          <strong>Money:</strong> ${money.toFixed(2)}
        </p>
        {Number(G.fishFood || 0) > 0 && (
          <p style={{ margin: '6px 0 0 0' }}>
            <strong>Fish Food Units:</strong> {Math.floor(Number(G.fishFood || 0))}
          </p>
        )}
      </div>

      {fetchError && (
        <div className="error-message">
          <span>{fetchError}</span>
        </div>
      )}

      {!catalog && !fetchError && (
        <p className="empty-message">Loading market catalog…</p>
      )}

      {items.length > 0 && (
        <div className="market-list">
          {items.map((item) => {
            const ownedQty = Math.floor(Number(owned[item.key] || 0));
            const qty = getQty(item.key);
            const totalCost = item.cost * qty;
            const disabled = loading || busyKey === item.key;

            return (
              <div key={item.key} className="market-item">
                <div className="market-item-info">
                  <div className="market-item-title" title={pretty(item.key)}>{pretty(item.key)}</div>
                  <div className="market-item-meta">
                    <span>Type: {String(item.type)}</span>
                    <span>Cost: ${Number(item.cost).toFixed(2)}</span>
                    <span>Owned: {ownedQty}</span>
                    {item.dailyElectricityCost > 0 && (
                      <span>Elec: ${item.dailyElectricityCost.toFixed(2)}/day</span>
                    )}
                  </div>
                  {item.description && (
                    <div className="market-item-desc" title={item.description}>{item.description}</div>
                  )}
                </div>

                <div className="market-item-actions">
                  <label className="market-qty">
                    <span>Qty</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={qty}
                      onChange={(e) => setQty(item.key, e.target.value)}
                      disabled={disabled}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={disabled}
                    onClick={() => handleBuy(item.key)}
                    title={`Buy ${qty} for $${totalCost.toFixed(2)}`}
                  >
                    Buy ${totalCost.toFixed(2)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {catalog && items.length === 0 && (
        <p className="empty-message">No market items found.</p>
      )}
    </section>
  );
};

export default MarketPanel;
