const { Plant } = require('./Plant');

class Tray {
	constructor(id, plantType, options = {}) {
		this.id = id;
		this.type = plantType;
		this.capacity = options.capacity || 24;
		this.plants = {}; // map of plantId -> Plant
	}

	plantSeed(plantId, plantType, options = {}) {
		if (Object.keys(this.plants).length >= this.capacity) {
			throw new Error('Tray at capacity');
		}
		this.plants[plantId] = new Plant(plantId, plantType, options);
		return this.plants[plantId];
	}

	removePlant(plantId) {
		if (this.plants[plantId]) {
			delete this.plants[plantId];
			return true;
		}
		return false;
	}

	growAll(water) {
		let totalGrowth = 0;
		let totalNutrients = 0;
		Object.values(this.plants).forEach(p => {
			const { growth, nutrientsUsed } = p.grow(water);
			totalGrowth += growth;
			totalNutrients += nutrientsUsed;
		});
		return { totalGrowth, totalNutrients };
	}

	_avg(metric) {
		const vals = Object.values(this.plants).map(p => p[metric]);
		if (!vals.length) return 0;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	}

	getAverageSize() { return this._avg('size'); }
	getAverageHealth() { return this._avg('health'); }
	getAverageMaturity() { return this._avg('maturity'); }
	getHarvestableCount() { return Object.values(this.plants).filter(p => p.canHarvest()).length; }
}

module.exports = { Tray };
