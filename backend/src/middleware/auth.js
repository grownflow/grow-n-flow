function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = {
    userId: String(userId),
    username: req.session?.username ? String(req.session.username) : null,
    email: req.session?.email ? String(req.session.email) : null,
  };
  next();
}

function optionalAuth(req, _res, next) {
  const userId = req.session?.userId;
  if (userId) {
    req.user = {
      userId: String(userId),
      username: req.session?.username ? String(req.session.username) : null,
      email: req.session?.email ? String(req.session.email) : null,
    };
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
