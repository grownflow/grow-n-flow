const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'aquaponics_dev';

let client;
let db;

async function connect() {
  if (db) return db;
  
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log('✅ MongoDB connected');
  return db;
}

async function getCollection(name) {
  const database = await connect();
  return database.collection(name);
}

async function close() {
  if (client) {
    await client.close();
  }
}

module.exports = { connect, getCollection, close };