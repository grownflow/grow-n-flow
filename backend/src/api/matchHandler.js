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
      money: G.money || 500,
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
        const tank = new Tank(G.aquaponicsSystem.tank.volumeLiters || 1000);
        if (G.aquaponicsSystem.tank.water) {
          const water = new WaterChemistry();
          Object.assign(water, G.aquaponicsSystem.tank.water);
          tank.water = water;
        }
        tank.biofilterEfficiency = G.aquaponicsSystem.tank.biofilterEfficiency || 0.8;
        tank.turn = G.aquaponicsSystem.tank.turn || 0;
        tank.log = G.aquaponicsSystem.tank.log || [];
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

  static async create() {
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
      G,
      ctx,
      players: ['0'],
      gameTime: 0,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

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

  static async makeMove(matchID, moveName, args, playerID) {
    const match = await this.getMatch(matchID);
    if (!match) {
      throw new Error('Match not found');
    }

    const move = AquaponicsGame.moves[moveName];
    if (!move) {
      throw new Error(`Move ${moveName} not found`);
    }

    try {
      const moveArgs = args || [];
      const newG = move(match.G, match.ctx, ...moveArgs);
      match.G = newG;
      match.ctx.turn++;

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