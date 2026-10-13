require('dotenv').config({ path: './frontend/server/.env' });
const mongoose = require('mongoose');

async function updateFares() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000
    });
    console.log('Connected!');
    
    const Bus = require('./frontend/server/models/bus');
    const Route = require('./frontend/server/models/route');
    
    const buses = await Bus.find().populate('routes').exec();
    console.log(`Found ${buses.length} buses`);
    
    const busTypeMultiplier = {
      'AC': 2.0,
      'Premium': 2.5,
      'Sleeper': 1.8,
      'non-AC': 1.0
    };
    
    let updated = 0;
    for (const bus of buses) {
      if (!bus.routes || !bus.routes.distance) continue;
      
      const basePerKm = 1.5;
      const multiplier = busTypeMultiplier[bus.busType] || 1.0;
      let facilities = 0;
      if (bus.liveTracking) facilities += 50;
      if (bus.reschedulable) facilities += 30;
      
      const fare = Math.round((bus.routes.distance * basePerKm * multiplier) + facilities);
      
      if (bus.fare !== fare) {
        await Bus.updateOne({ _id: bus._id }, { fare });
        console.log(`✅ ${bus.registrationNumber}: ${bus.fare} → ₹${fare}`);
        updated++;
      } else {
        console.log(`ℹ️  ${bus.registrationNumber}: already ₹${fare}`);
      }
    }
    
    console.log(`\n✅ Updated ${updated} buses`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateFares();
