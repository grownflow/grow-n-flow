// All moves related to economic aspects of the game
// Handles buying/selling, equipment purchases, market interactions

const { equipment } = require('../data/equipment');

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function unwrapMoveArgs(firstArg, secondArg) {
  // Supports both boardgame.io signature:
  //   ({ G, ctx }, ...)
  // and older direct-call signature used in some scripts/tests:
  //   (G, ctx, ...)
  if (firstArg && typeof firstArg === 'object' && 'G' in firstArg && 'ctx' in firstArg) {
    return { G: firstArg.G, ctx: firstArg.ctx };
  }
  return { G: firstArg, ctx: secondArg };
}

function unwrapBuyEquipmentArgs(arg1, arg2, arg3, arg4) {
  // boardgame.io: (ctxArg, equipmentType, quantity)
  if (arg1 && typeof arg1 === 'object' && 'G' in arg1 && 'ctx' in arg1) {
    return { G: arg1.G, ctx: arg1.ctx, equipmentType: arg2, quantity: arg3 };
  }
  // legacy scripts: (G, ctx, equipmentType, quantity)
  return { G: arg1, ctx: arg2, equipmentType: arg3, quantity: arg4 };
}

function ensureSystemState(G) {
  if (!G.aquaponicsSystem) G.aquaponicsSystem = { tank: {}, light: { isOn: true } };
  if (!G.aquaponicsSystem.tank) G.aquaponicsSystem.tank = {};
  if (!G.aquaponicsSystem.tank.water) G.aquaponicsSystem.tank.water = {};
  const tank = G.aquaponicsSystem.tank;
  const water = tank.water;

  tank.biofilterEfficiency = clampNumber(tank.biofilterEfficiency ?? 0.8, 0, 1);
  tank.circulationEfficiency = clampNumber(tank.circulationEfficiency ?? 1.0, 0.5, 2.0);
  water.pH = clampNumber(water.pH ?? 7.0, 0, 14);
  water.dissolvedOxygen = clampNumber(water.dissolvedOxygen ?? 8.0, 0, 20);
  water.potassium = clampNumber(water.potassium ?? 40, 0, 10000);
  water.calcium = clampNumber(water.calcium ?? 60, 0, 10000);
  water.iron = clampNumber(water.iron ?? 2, 0, 10000);

  return { tank, water };
}

const economyMoves = {
  getEquipmentCatalog: (arg1, arg2) => {
    const { G } = unwrapMoveArgs(arg1, arg2);
    if (G) {
      G.lastAction = {
        type: 'getEquipmentCatalog',
        success: true,
        equipment
      };
    }
    return G;
  },

  // Buy equipment or upgrades
  // Parameters: equipmentType, quantity
  buyEquipment: (arg1, arg2, arg3, arg4) => {
    const { G, ctx, equipmentType, quantity } = unwrapBuyEquipmentArgs(arg1, arg2, arg3, arg4);
    const type = String(equipmentType || '');
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));

    const data = equipment[type];
    if (!data) {
      if (G) {
        G.error = `Unknown equipment: ${type}`;
        G.lastAction = { type: 'buyEquipment', success: false, reason: 'unknown_equipment', equipmentType: type };
      }
      return Object.assign(G || {}, { error: `Unknown equipment: ${type}` });
    }

    if (!G.equipment) G.equipment = {};

    const unitCost = Number(data.cost || 0);
    const totalCost = unitCost * qty;
    const money = Number(G.money || 0);
    if (money < totalCost) {
      const msg = `Insufficient funds. Need $${totalCost}, have $${money}`;
      G.error = msg;
      G.lastAction = { type: 'buyEquipment', success: false, reason: 'insufficient_funds', equipmentType: type, quantity: qty, cost: totalCost };
      return Object.assign(G, { error: msg });
    }

    G.money = money - totalCost;
    // packQuantity > 1 means buying 1 purchase unit stocks multiple inventory units (e.g. aeration stones: pack of 10)
    const stockPerPurchase = (Number.isFinite(data.packQuantity) && data.packQuantity > 1) ? data.packQuantity : 1;
    G.equipment[type] = (Number(G.equipment[type]) || 0) + qty * stockPerPurchase;

    const benefits = [];
    const { tank, water } = ensureSystemState(G);

    if (type === 'biofilter') {
      tank.biofilterEfficiency = clampNumber(tank.biofilterEfficiency + 0.05 * qty, 0, 1);
      benefits.push('Improved nitrogen cycle efficiency');
    }

    if (type === 'waterPump') {
      tank.circulationEfficiency = clampNumber(tank.circulationEfficiency + 0.05 * qty, 0.5, 2.0);
      benefits.push('Improved water circulation');
    }

    if (type === 'airPump') {
      water.dissolvedOxygen = clampNumber(water.dissolvedOxygen + 0.5 * qty, 0, 20);
      benefits.push('Increased oxygen levels');
    }

    if (type === 'fishFood') {
      // Keep a simple fish-food stockpile for later when feedFish is implemented.
      G.fishFood = (Number(G.fishFood) || 0) + (10 * qty);
      benefits.push(`Added ${10 * qty} units of fish food`);
    }

    // Consumables with waterEffects are stored in inventory.
    // Apply them manually via the applyConsumable move from the Water Quality panel.
    if (data.type === 'consumable' && data.waterEffects) {
      const totalStocked = qty * stockPerPurchase;
      benefits.push(`Added ${totalStocked} to inventory — apply from Water Quality panel`);
    }

    if (!G.systemModifiers) G.systemModifiers = {};
    if (type === 'growLight') {
      // Used in systemMoves.progressTurn to accelerate plant aging.
      G.systemModifiers.plantGrowthMultiplier = clampNumber((G.systemModifiers.plantGrowthMultiplier ?? 1.0) + 0.1 * qty, 1.0, 3.0);
      benefits.push('Improved plant growth rate');
      if (!G.aquaponicsSystem.light) G.aquaponicsSystem.light = { isOn: true };
      G.aquaponicsSystem.light.isOn = true;
    }

    G.lastAction = {
      type: 'buyEquipment',
      success: true,
      equipmentType: type,
      quantity: qty,
      cost: totalCost,
      benefits
    };

    return G;
  },

  sellFish: ({ G, ctx }, fishIdentifier) => {
    let indicesToSell = [];

    const getMarketValue = (fish) => {
      const weightInPounds = (fish.weight / 1000) * 2.20462;
      const mv = fish.marketValue || 5; 
      const healthMult = (fish.health || 10) / 10;
      return weightInPounds * mv * healthMult;
    };

    const isHarvestable = (fish) => {
      const hw = fish.harvestWeight || 800;
      return fish.weight >= hw * 0.8;
    };

    if (fishIdentifier !== undefined) {
      let index = G.fish.findIndex(f => f.id === fishIdentifier);

      if (index === -1 || !G.fish[index]) {
        console.log("Fish not found to sell!");
        return;
      }
      
      const fish = G.fish[index];
      if (!isHarvestable(fish)) {
        G.lastAction = { type: 'sellFish', success: false, reason: 'not_harvestable' };
        return;
      }
      indicesToSell.push(index);
    } else {
      // Sell all harvestable
      G.fish.forEach((f, i) => {
        if (isHarvestable(f)) indicesToSell.push(i);
      });
      if (indicesToSell.length === 0) {
        G.lastAction = { type: 'sellFish', success: false, reason: 'no_harvestable_fish' };
        return;
      }
    }

    let totalValue = 0;
    const fishSold = [];
    
    // Remove from back to front to not mess up indices
    indicesToSell.sort((a, b) => b - a).forEach(index => {
      const fish = G.fish[index];
      totalValue += getMarketValue(fish);
      fishSold.push(fish);
      G.fish.splice(index, 1); // remove from array
    });

    G.money = (G.money || 0) + totalValue;
    G.lastAction = {
      type: 'sellFish',
      success: true,
      fishSold,
      totalValue
    };
  },

  // Sell harvested products from inventory.
  // Parameters: productType (e.g. 'ParrisIslandRomaine'), quantity (optional; default all)
  sellProducts: (arg1, arg2, arg3, arg4) => {
    const { G, ctx } = unwrapMoveArgs(arg1, arg2);
    const productType = (arg1 && typeof arg1 === 'object' && 'G' in arg1 && 'ctx' in arg1)
      ? arg2
      : arg3;
    const quantity = (arg1 && typeof arg1 === 'object' && 'G' in arg1 && 'ctx' in arg1)
      ? arg3
      : arg4;

    const key = String(productType || '');
    if (!key) {
      G.lastAction = { type: 'sellProducts', success: false, reason: 'missing_product_type' };
      G.error = 'Missing product type';
      return Object.assign(G, { error: 'Missing product type' });
    }

    const produce = G.inventory?.produce;
    const entry = produce ? produce[key] : null;
    const available = Number(entry?.count || 0);
    if (!entry || available <= 0) {
      G.lastAction = { type: 'sellProducts', success: false, reason: 'not_in_inventory', productType: key };
      G.error = `No inventory available for: ${key}`;
      return Object.assign(G, { error: `No inventory available for: ${key}` });
    }

    const requested = Number(quantity);
    const qty = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : available;
    const sellQty = Math.max(1, Math.min(available, qty));

    const unitPrice = Number(entry.unitPrice || 0);
    const totalValue = sellQty * unitPrice;
    G.money = (Number(G.money) || 0) + totalValue;

    const remaining = available - sellQty;
    if (remaining <= 0) {
      delete G.inventory.produce[key];
    } else {
      G.inventory.produce[key] = { ...entry, count: remaining };
    }

    G.lastAction = {
      type: 'sellProducts',
      success: true,
      productType: key,
      quantity: sellQty,
      unitPrice,
      totalValue,
    };

    return G;
  },

  // Skip turn to advance time and save energy
  skipTurn: ({ G, ctx }) => {
    console.log(`Player ${ctx.currentPlayer} skipped turn - time advances`);
    G.gameTime += 1;
    // TODO: Run background simulations, regenerate energy
  }
};

module.exports = economyMoves;
