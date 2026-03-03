const router = require('express').Router();
const { MatchHandler } = require('../matchHandler');

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

module.exports = router;