require('dotenv').config();
const { getCollection, close } = require('../src/db');

async function createIndexes() {
  try {
    const matches = await getCollection('matches');
    
    await matches.createIndex({ matchID: 1 }, { unique: true });
    await matches.createIndex({ players: 1 });
    await matches.createIndex({ gameTime: 1 });
    await matches.createIndex({ status: 1 });
    await matches.createIndex({ createdAt: -1 });
    
    console.log('Indexes created');
    await close();
  } catch (error) {
    console.error('Index creation failed:', error);
    process.exit(1);
  }
}

createIndexes();