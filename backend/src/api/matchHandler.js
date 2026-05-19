const { getCollection } = require('../db');
const { AquaponicsGame } = require('../game/game');
const { Fish } = require('../game/models/Fish');
const { Plant } = require('../game/models/Plant');
const { AquaponicsSystem } = require('../game/models/AquaponicsSystem');
const { Tank } = require('../game/models/Tank');
const { GrowBed } = require('../game/models/GrowBed');
const { Light } = require('../game/models/Light');
const { WaterChemistry } = require('../game/models/WaterChemistry');

class MatchHandler {
  // snapshot: optional pre-built object { gameTime, water, tank, fishDeaths, plantDeaths, event }
  // When snapshot is provided G is ignored (used by progressMultipleTurns for per-day records).
  static async recordWaterReading(matchID, G, snapshot = null) {
    try {
      const readings = await getCollection('water_readings');

      if (snapshot) {
        await readings.insertOne({
          matchID: String(matchID),
          createdAt: new Date(),
          ...snapshot,
        });
        return;
      }

      const water = G?.aquaponicsSystem?.tank?.water;
      const tank = G?.aquaponicsSystem?.tank;
      if (!water || !tank) return;

      const gameTime = Number(G.gameTime || 0);

      await readings.insertOne({
        matchID: String(matchID),
        gameTime,
        createdAt: new Date(),
        water: {
          ammonia: Number(water.ammonia ?? 0),
          nitrite: Number(water.nitrite ?? 0),
          nitrate: Number(water.nitrate ?? 0),
          pH: Number(water.pH ?? 7),
          temperature: Number(water.temperature ?? 25),
          dissolvedOxygen: Number(water.dissolvedOxygen ?? 8),
          phosphorus: Number(water.phosphorus ?? 0),
          potassium: Number(water.potassium ?? 0),
          calcium: Number(water.calcium ?? 0),
          magnesium: Number(water.magnesium ?? 0),
          iron: Number(water.iron ?? 0),
        },
        tank: {
          capacity: Number(tank.capacity ?? tank.volumeLiters ?? 1000),
          currentVolume: Number(tank.currentVolume ?? tank.currentWaterLevel ?? 0),
          biofilterEfficiency: Number(tank.biofilterEfficiency ?? 0.8),
        },
        fishDeaths: Array.isArray(G.lastAction?.fishDeaths) ? G.lastAction.fishDeaths.length : 0,
        plantDeaths: Array.isArray(G.lastAction?.plantDeaths) ? G.lastAction.plantDeaths.length : 0,
        event: G.activeEvent
          ? {
              id: String(G.activeEvent.id),
              type: String(G.activeEvent.type),
              severity: String(G.activeEvent.severity),
            }
          : null,
      });
    } catch (e) {
      // Do not fail moves if history logging fails.
      console.warn('[recordWaterReading] failed:', e.message);
    }
  }

  // Reconstruct class instances from plain objects
  static deserializeGameState(G) {
    // First, reconstruct all plants
    const plantsMap = new Map();
    (G.plants || []).forEach(p => {
      const plant = new Plant(p.id, p.type);
      Object.assign(plant, p);
      plantsMap.set(p.id, plant);
    });
    
    const deserialized = {
      ...G,
      gameTime: G.gameTime || 0,
      money: G.money || 1000,
      fish: (G.fish || []).map(f => 
        Object.assign(new Fish(f.type, f.count), f)
      ),
      plants: Array.from(plantsMap.values()),
    };

    // Reconstruct AquaponicsSystem if it exists
    if (G.aquaponicsSystem) {
      const sys = new AquaponicsSystem();
      
      // Reconstruct Tank with WaterChemistry
      if (G.aquaponicsSystem.tank) {
        const tankData = G.aquaponicsSystem.tank;
        const tank = new Tank(tankData.volumeLiters || tankData.capacity || 1000);

        // Preserve persisted schema fields (capacity/currentVolume/foodInTank/etc).
        // Tank is a legacy class; without copying, newer plain-state fields are dropped.
        Object.assign(tank, tankData);

        if (tankData.water) {
          const water = new WaterChemistry();
          Object.assign(water, tankData.water);
          tank.water = water;
        }

        // Ensure commonly relied-on fields exist.
        if (tank.foodInTank === undefined || tank.foodInTank === null) {
          tank.foodInTank = 0;
        }
        if (tank.biofilterEfficiency === undefined || tank.biofilterEfficiency === null) {
          tank.biofilterEfficiency = 0.8;
        }
        if (!Array.isArray(tank.log)) {
          tank.log = [];
        }
        if (tank.turn === undefined || tank.turn === null) {
          tank.turn = 0;
        }

        sys.tank = tank;
      }
      
      // Reconstruct GrowBeds
      if (G.aquaponicsSystem.growBeds) {
        sys.growBeds = {};
        for (const [bedId, bedData] of Object.entries(G.aquaponicsSystem.growBeds)) {
          const bed = new GrowBed(bedData.id, bedData.plantType, bedData.capacity);
          bed.nutrientDemand = bedData.nutrientDemand || 0;
          
          // Use the same plant instances from the plantsMap
          if (bedData.plants) {
            bed.plants = {};
            for (const [plantId, plantData] of Object.entries(bedData.plants)) {
              // Reuse the plant instance from plantsMap if it exists
              const plant = plantsMap.get(plantData.id);
              if (plant) {
                bed.plants[plantId] = plant;
              } else {
                // Fallback: create new instance if not in map
                const newPlant = new Plant(plantData.id, plantData.type);
                Object.assign(newPlant, plantData);
                bed.plants[plantId] = newPlant;
              }
            }
          }
          
          sys.growBeds[bedId] = bed;
        }
      }
      
      // Reconstruct Light
      if (G.aquaponicsSystem.light) {
        const light = new Light();
        Object.assign(light, G.aquaponicsSystem.light);
        sys.light = light;
      }
      
      // Copy remaining properties
      sys.turn = G.aquaponicsSystem.turn || 0;
      sys.log = G.aquaponicsSystem.log || [];
      
      deserialized.aquaponicsSystem = sys;
    }

    return deserialized;
  }

  static async create({ ownerUserId } = {}) {
    const matchID = Math.random().toString(36).substring(2, 15);
    const G = AquaponicsGame.setup();
    const ctx = {
      currentPlayer: '0',
      turn: 1,
      numPlayers: 1,
      playOrder: ['0'],
      playOrderPos: 0
    };

    const matches = await getCollection('matches');
    await matches.insertOne({
      matchID,
      ownerUserId: ownerUserId ? String(ownerUserId) : null,
      G,
      ctx,
      players: ['0'],
      gameTime: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed initial water reading for graphs.
    await this.recordWaterReading(matchID, G);

    return { matchID };
  }

  static async getMatch(matchID) {
    const matches = await getCollection('matches');
    const match = await matches.findOne({ matchID });
    
    if (!match) {
      return null;
    }

    // Reconstruct class instances
    const G = this.deserializeGameState(match.G);
    return { G, ctx: match.ctx };
  }

  static isValidMoveName(moveName) {
    return typeof moveName === 'string' && Object.prototype.hasOwnProperty.call(AquaponicsGame.moves, moveName);
  }

  static async makeMove(matchID, moveName, args, playerID) {
    const match = await this.getMatch(matchID);
    if (!match) {
      throw new Error('Match not found');
    }

    const normalizedMoveName = typeof moveName === 'string' ? moveName : String(moveName || '');
    if (!this.isValidMoveName(normalizedMoveName)) {
      throw new Error(`Move ${normalizedMoveName || 'undefined'} not found`);
    }

    const move = AquaponicsGame.moves[normalizedMoveName];

    try {
      const moveArgs = Array.isArray(args) ? args : [];
      // Call move using the expected signature used throughout moves: ({ G, ctx }, ...args)
      // Many moves mutate G in-place and do not return a value, so support both styles.
      const result = move({ G: match.G, ctx: match.ctx }, ...moveArgs);
      const newG = result || match.G;
      match.G = newG;
      match.ctx.turn++;

      if (moveName === 'progressTurn') {
        await this.recordWaterReading(matchID, newG);
      } else if (moveName === 'progressMultipleTurns') {
        const snapshots = newG.lastAction?.waterSnapshots;
        if (Array.isArray(snapshots) && snapshots.length > 0) {
          for (const snap of snapshots) {
            await this.recordWaterReading(matchID, null, snap);
          }
        } else {
          // Fallback: single snapshot from final state
          await this.recordWaterReading(matchID, newG);
        }
      }

      const matches = await getCollection('matches');
      await matches.updateOne(
        { matchID },
        {
          $set: {
            G: newG,
            ctx: match.ctx,
            gameTime: newG.gameTime || 0,
            updatedAt: new Date()
          }
        }
      );

      return { G: newG, ctx: match.ctx };
    } catch (error) {
      throw new Error(`Move failed: ${error.message}`);
    }
  }

  static async deleteMatch(matchID) {
    const matches = await getCollection('matches');
    await matches.deleteOne({ matchID });

    // Best-effort cleanup of history
    try {
      const readings = await getCollection('water_readings');
      await readings.deleteMany({ matchID: String(matchID) });
    } catch (e) {
      console.warn('[deleteMatch] failed to delete water_readings:', e.message);
    }
  }

  static async listMatches(status = 'active', limit = 50) {
    const matches = await getCollection('matches');
    return await matches
      .find({ status })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }
}

module.exports = { MatchHandler };