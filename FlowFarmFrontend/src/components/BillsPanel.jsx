import React from 'react';

const BillsPanel = ({ gameState }) => {
  if (!gameState || !gameState.G) return null;

  const { G } = gameState;
  const billsAccrued = G.billsAccrued || { electricity: 0, water: 0 };
  const totalAccrued = billsAccrued.electricity + billsAccrued.water;
  const daysSinceLastBill = G.gameTime - (G.lastBillPaid || 0);
  const daysUntilBill = Math.max(0, 30 - daysSinceLastBill);

  // Check if the last action included a bill payment
  const lastBill = G.lastAction?.billPayment || null;

  return (
    <section className="bills-panel">
      <h2>💸 Utility Bills</h2>

      {/* Upcoming bill summary */}
      <div className="bills-accrued">
        <div className="bill-countdown">
          <span className="bill-countdown-label">Next bill in</span>
          <span className="bill-countdown-days">{daysUntilBill}</span>
          <span className="bill-countdown-label">days</span>
        </div>

        <div className="bill-breakdown">
          <div className="bill-line">
            <span className="bill-icon">⚡</span>
            <span className="bill-label">Electricity</span>
            <span className="bill-amount">${billsAccrued.electricity.toFixed(2)}</span>
          </div>
          <div className="bill-line">
            <span className="bill-icon">💧</span>
            <span className="bill-label">Water</span>
            <span className="bill-amount">${billsAccrued.water.toFixed(2)}</span>
          </div>
          <div className="bill-line bill-total">
            <span className="bill-icon">📄</span>
            <span className="bill-label">Running Total</span>
            <span className="bill-amount">${totalAccrued.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Last bill payment notification */}
      {lastBill && (
        <div className={`bill-notification ${lastBill.paid ? 'bill-paid' : 'bill-unpaid'}`}>
          <div className="bill-notification-header">
            {lastBill.paid ? '✅ Bill Paid' : '⚠️ Bill Unpaid'}
          </div>
          <div className="bill-notification-details">
            <span>⚡ ${lastBill.electricity.toFixed(2)}</span>
            <span>💧 ${lastBill.water.toFixed(2)}</span>
            <span className="bill-notification-total">Total: ${lastBill.total.toFixed(2)}</span>
          </div>
          {lastBill.debt > 0 && (
            <div className="bill-debt">
              🚨 Debt: ${lastBill.debt.toFixed(2)}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default BillsPanel;
