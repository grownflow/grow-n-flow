const express = require("express");
const router = express.Router();

// Import route modules when they're created
// const simulationRoutes = require("./simulation");
// const gameRoutes = require("./game");

// Mount routes
// router.use("/simulation", simulationRoutes);
// router.use("/game", gameRoutes);

// Health check for API
router.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

module.exports = router;