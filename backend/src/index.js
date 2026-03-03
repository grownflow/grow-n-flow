const { app, bgioServer } = require("./app");
const { connect } = require('./db');

require('dotenv').config();

async function start() {
  try {
    // Connect to MongoDB first
    await connect();
    
    // Then start servers
    app.listen(4000, () => {
      console.log('Express API running on http://localhost:4000');
    });

    bgioServer.run(8000, () => {
      console.log('Boardgame.io server on http://localhost:8000');
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

start();