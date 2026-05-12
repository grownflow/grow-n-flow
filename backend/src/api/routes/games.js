const router = require('express').Router();
const { MatchHandler } = require('../matchHandler');
const { getCollection } = require('../../db');
const { requireAuth } = require('../../middleware/auth');

// All game routes require authentication (cookie-based session)
router.use(requireAuth);

// List the current user's matches (lightweight metadata only)
// Query params:
// - status: active|archived|completed (optional)
// - limit: max items (default 50, max 200)
router.get('/:gameName/matches', async (req, res) => {
  try {
    const ownerUserId = req.user.userId;
    const status = req.query.status ? String(req.query.status) : null;
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50)));

    const matches = await getCollection('matches');
    const query = { ownerUserId: String(ownerUserId) };
    if (status) query.status = status;

    const items = await matches
      .find(query, {
        projection: {
          _id: 0,
          matchID: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          gameTime: 1,
        },
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:gameName/create', async (req, res) => {
  try {
    const ownerUserId = req.user.userId;

    // Archive any previously-active matches for this user.
    const matches = await getCollection('matches');
    await matches.updateMany(
      { ownerUserId: String(ownerUserId), status: 'active' },
      { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } }
    );

    const result = await MatchHandler.create({ ownerUserId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resume most recent active match; if none exists, create one.
router.post('/:gameName/resume', async (req, res) => {
  try {
    const ownerUserId = req.user.userId;

    const matches = await getCollection('matches');
    const existing = await matches
      .find({ ownerUserId: String(ownerUserId), status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(1)
      .toArray();

    if (existing && existing[0]?.matchID) {
      return res.json({ matchID: String(existing[0].matchID) });
    }

    const result = await MatchHandler.create({ ownerUserId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Archive a match (owner only)
router.post('/:gameName/:matchID/archive', async (req, res) => {
  try {
    const { matchID } = req.params;
    const ownerUserId = req.user.userId;

    const matches = await getCollection('matches');
    const result = await matches.updateOne(
      { matchID: String(matchID), ownerUserId: String(ownerUserId) },
      { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } }
    );

    if (!result.matchedCount) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:gameName/:matchID', async (req, res) => {
  try {
    const { matchID } = req.params;
    const ownerUserId = req.user.userId;

    const matches = await getCollection('matches');
    const exists = await matches.findOne(
      { matchID: String(matchID) },
      { projection: { ownerUserId: 1 } }
    );

    if (!exists) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (String(exists.ownerUserId || '') !== String(ownerUserId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const match = await MatchHandler.getMatch(String(matchID));
    res.json({ G: match.G, ctx: match.ctx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:gameName/:matchID/move', async (req, res) => {
  try {
    const { matchID } = req.params;
    const { move, args, playerID } = req.body;
    const ownerUserId = req.user.userId;

    const matches = await getCollection('matches');
    const exists = await matches.findOne(
      { matchID: String(matchID) },
      { projection: { ownerUserId: 1 } }
    );

    if (!exists) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (String(exists.ownerUserId || '') !== String(ownerUserId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await MatchHandler.makeMove(String(matchID), move, args, playerID);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Water history for graphing
// Query params:
// - limit: max points (default 200)
// - from: minimum gameTime (inclusive)
router.get('/:gameName/:matchID/water-history', async (req, res) => {
  try {
    const { matchID } = req.params;
    const ownerUserId = req.user.userId;

    const matches = await getCollection('matches');
    const exists = await matches.findOne(
      { matchID: String(matchID) },
      { projection: { ownerUserId: 1 } }
    );

    if (!exists) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (String(exists.ownerUserId || '') !== String(ownerUserId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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
