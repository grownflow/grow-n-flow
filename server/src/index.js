const express = require("express");
const { Server } = require("boardgame.io/server");
const app = express();
const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Aquaponics backend running.");
});

app.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT}`);
});
