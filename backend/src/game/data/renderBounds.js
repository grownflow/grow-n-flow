const WATER_VOLUME_BOUNDS = {
	minX: 1.7,
	maxX: 3.6,
	minY: 0.56,
	maxY: 0.78,
	minZ: -1.26,
	maxZ: -0.84,
};

function randomInRange(min, max) {
	return min + Math.random() * (max - min);
}

function randomPointInWaterVolume() {
	return {
		x: randomInRange(WATER_VOLUME_BOUNDS.minX, WATER_VOLUME_BOUNDS.maxX),
		y: randomInRange(WATER_VOLUME_BOUNDS.minY, WATER_VOLUME_BOUNDS.maxY),
		z: randomInRange(WATER_VOLUME_BOUNDS.minZ, WATER_VOLUME_BOUNDS.maxZ),
	};
}

module.exports = {
	WATER_VOLUME_BOUNDS,
	randomPointInWaterVolume,
};
