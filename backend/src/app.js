const express = require("express");
const cors = require("@koa/cors");
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

// Create boardgame.io server
const bgioServer = Server({
  games: [AquaponicsGame],
  origins: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ],
});

// Add Koa CORS middleware to boardgame.io's Koa app
bgioServer.app.use(cors({
  origin: '*',
  credentials: true,
}));

module.exports = { app, bgioServer };
