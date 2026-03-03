/*
 *  
 */

class Sensor {
	constructor(name, readFn, noiseLevel = 0.01) {
		this.name = name;
		this.readFn = readFn;
		this.noiseLevel = noiseLevel;
	}

	read() {
		const value = this.readFn();
		const noise = (Math.random() * 2 - 1) * this.noiseLevel * value;
		return +(value + noise).toFixed(2);
	}
}

module.exports = { Sensor };
