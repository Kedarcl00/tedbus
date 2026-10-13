require('dotenv').config();
const mongoose = require('mongoose');
const Bus = require('./frontend/server/models/bus');
const Route = require('./frontend/server/models/route');

async function checkBusFares() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const buses = await Bus.find().populate('routes').exec();
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚌 All Buses with Fares');
    console.log('═══════════════════════════════════════════════════════════════\n');

    buses.forEach((bus, index) => {
      const route = bus.routes;
      console.log(`${index + 1}. ${bus.registrationNumber}`);
      console.log(`   Route: ${route.departureLocation.name} → ${route.arrivalLocation.name}`);
      console.log(`   Bus Type: ${bus.busType}`);
      console.log(`   Operator: ${bus.operatorName}`);
      console.log(`   Departure: ${bus.departureTime} | Arrival: ${bus.arrivalTime}`);
      console.log(`   💰 Fare: ₹${bus.fare}`);
      console.log(`   Total Seats: ${bus.totalSeats}`);
      console.log(`   Live Tracking: ${bus.liveTracking ? '✅' : '❌'} | Reschedulable: ${bus.reschedulable ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Buses: ${buses.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkBusFares();
