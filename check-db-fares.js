require('dotenv').config({ path: './frontend/server/.env' });
const mongoose = require('mongoose');
const Bus = require('./frontend/server/models/bus');

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const buses = await Bus.find().select('registrationNumber fare busType routes').lean();
    console.log(`Found ${buses.length} buses:\n`);
    buses.forEach(b => {
      console.log(`${b.registrationNumber} (${b.busType}): fare=${b.fare}`);
    });
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

check();
