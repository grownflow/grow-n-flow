require('dotenv').config();
const { getCollection, close } = require('../src/db');

async function test() {
  try {
    const matches = await getCollection('matches');
    const count = await matches.countDocuments();
    console.log('✅ MongoDB connected. Match count:', count);
    await close();
  } catch (error) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
}

test();