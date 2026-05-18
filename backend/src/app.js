const express = require("express");
const cors = require("@koa/cors");
const expressCors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Server } = require("boardgame.io/server");
const { AquaponicsGame } = require("./game/game");

const app = express();
app.disable('x-powered-by');

// Basic middleware
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  next();
});

// CORS (must allow credentials for cookie-based sessions)
// Supports a comma-separated allowlist via FRONTEND_ORIGIN.
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = (process.env.FRONTEND_ORIGIN
  ? String(process.env.FRONTEND_ORIGIN).split(',').map((s) => s.trim()).filter(Boolean)
  : defaultOrigins
);

app.use(expressCors({
  origin: (origin, cb) => {
    // Allow same-origin / server-to-server requests with no Origin header.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Sessions (stored in Mongo)
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'aquaponics_dev';
const sessionSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production');
}

app.use(session({
  name: 'gnf.sid',
  secret: sessionSecret || 'dev_only_change_me',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: mongoUri,
    dbName,
    collectionName: 'sessions',
    stringify: false,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
}));

// Health check
app.get("/", (req, res) => {
  res.send("Aquaponics backend running.");
});

// API routes
app.use("/api", require("./api/routes/index"));

// Generic error handler
app.use((err, req, res, next) => {
  console.error('[API error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create boardgame.io server
const bgioServer = Server({
  games: [AquaponicsGame],
  origins: allowedOrigins,
});

// Add Koa CORS middleware to boardgame.io's Koa app
bgioServer.app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

module.exports = { app, bgioServer };
