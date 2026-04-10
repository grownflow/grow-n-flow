const router = require('express').Router();
const { MatchHandler } = require('../matchHandler');
const { getCollection } = require('../../db');

router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

router.post('/games/:gameName/create', async (req, res) => {
  try {
    const result = await MatchHandler.create();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/games/:gameName/:matchID', async (req, res) => {
  try {
    const match = await MatchHandler.getMatch(req.params.matchID);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json({ G: match.G, ctx: match.ctx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/games/:gameName/:matchID/move', async (req, res) => {
  try {
    const { matchID } = req.params;
    const { move, args, playerID } = req.body;
    
    const result = await MatchHandler.makeMove(matchID, move, args, playerID);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Water history for graphing
// Query params:
// - limit: max points (default 200)
// - from: minimum gameTime (inclusive)
router.get('/games/:gameName/:matchID/water-history', async (req, res) => {
  try {
    const { matchID } = req.params;
    const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 200)));
    const from = req.query.from !== undefined ? Number(req.query.from) : null;

    const readings = await getCollection('water_readings');
    const query = { matchID: String(matchID) };
    if (Number.isFinite(from)) {
      query.gameTime = { $gte: from };
    }

    const items = await readings
      .find(query, { projection: { _id: 0 } })
      .sort({ gameTime: 1 })
      .limit(limit)
      .toArray();

    res.json({ matchID: String(matchID), items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;