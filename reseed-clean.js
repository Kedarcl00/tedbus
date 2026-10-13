require('dotenv').config({ path: './frontend/server/.env' });
const mongoose = require('mongoose');
const Bus = require('./frontend/server/models/bus');
const Route = require('./frontend/server/models/route');

async function cleanAndSeed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Delete all buses and routes
    await Bus.deleteMany({});
    await Route.deleteMany({});
    console.log('✅ Cleared existing data');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanAndSeed();
