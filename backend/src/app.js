const express = require("express");
const { Server } = require("boardgame.io/server");
const { AquaponicsGame } = require("./game/game");

const app = express();

// Basic middleware
app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "*");
  next();
});

// Health check
app.get("/", (req, res) => {
  res.send("Aquaponics backend running.");
});

// API routes
app.use("/api", require("./api/routes/index"));

// Create boardgame.io server, start separately
const bgioServer = Server({
  games: [AquaponicsGame],
  origins: ["*"]
});

module.exports = { app, bgioServer };
