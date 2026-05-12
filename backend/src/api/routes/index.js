const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/games', require('./games'));

router.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

module.exports = router;