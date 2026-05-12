const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { getCollection } = require('../../db');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const usernameRaw = req.body?.username;
    const username = usernameRaw ? normalizeUsername(usernameRaw) : null;
    const password = String(req.body?.password || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (username !== null && username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const users = await getCollection('users');
    const existing = await users.findOne({ $or: [{ email }, ...(username ? [{ username }] : [])] });
    if (existing) {
      return res.status(409).json({ error: 'Account already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const doc = {
      email,
      username,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };

    const result = await users.insertOne(doc);

    // Log them in immediately
    req.session.userId = String(result.insertedId);
    req.session.email = email;
    req.session.username = username;

    res.json({
      user: {
        id: String(result.insertedId),
        email,
        username,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier) {
      return res.status(400).json({ error: 'identifier is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'password is required' });
    }

    const users = await getCollection('users');
    const email = normalizeEmail(identifier);
    const username = normalizeUsername(identifier);

    const user = await users.findOne({ $or: [{ email }, { username }] });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, String(user.passwordHash || ''));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await users.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    req.session.userId = String(user._id);
    req.session.email = user.email ? String(user.email) : null;
    req.session.username = user.username ? String(user.username) : null;

    res.json({
      user: {
        id: String(user._id),
        email: user.email ? String(user.email) : null,
        username: user.username ? String(user.username) : null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', (req, res) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: String(userId),
      email: req.session?.email ? String(req.session.email) : null,
      username: req.session?.username ? String(req.session.username) : null,
    },
  });
});

router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('gnf.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
