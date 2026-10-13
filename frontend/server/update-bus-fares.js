/**
 * Script to Add Fares to All Existing Buses
 * 
 * Updates all buses in the database with calculated fares based on:
 * - Route distance
 * - Bus type multiplier
 * - Optional facilities (live tracking, reschedulable)
 * 
 * Run: node update-bus-fares.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Bus = require('./models/bus');
const Route = require('./models/route');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tedbus';

// Bus type fare multipliers (INR per km)
const busTypeMultiplier = {
  'AC': 2.0,
  'Premium': 2.5,
  'Sleeper': 1.8,
  'non-AC': 1.0
};

const baseFarePerKm = 1.5; // Base fare in INR per km

async function updateBusFares() {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Fetch all buses with their routes
    console.log('🔍 Fetching all buses...');
    const buses = await Bus.find().populate('routes').exec();
    console.log(`📦 Found ${buses.length} buses\n`);

    if (buses.length === 0) {
      console.log('⚠️  No buses found in database');
      await mongoose.connection.close();
      process.exit(0);
    }

    let updatedCount = 0;
    const updatedBuses = [];

    // Process each bus
    for (const bus of buses) {
      try {
        // Get route distance
        const route = bus.routes;
        if (!route || !route.distance) {
          console.log(`⚠️  Bus ${bus.registrationNumber} - No route distance found, skipping`);
          continue;
        }

        // Get bus type multiplier
        const typeMultiplier = busTypeMultiplier[bus.busType] || 1.0;

        // Calculate facility additions
        let facilityAddition = 0;
        if (bus.liveTracking) facilityAddition += 50; // ₹50 for live tracking
        if (bus.reschedulable) facilityAddition += 30; // ₹30 for reschedulable

        // Calculate total fare: (distance * baseFarePerKm * typeMultiplier) + facilities
        const calculatedFare = Math.round((route.distance * baseFarePerKm * typeMultiplier) + facilityAddition);

        // Update bus if it doesn't have a fare or has 0 fare
        if (!bus.fare || bus.fare === 0 || bus.fare === null) {
          await Bus.updateOne(
            { _id: bus._id },
            { fare: calculatedFare }
          );
          updatedCount++;
          updatedBuses.push({
            registration: bus.registrationNumber,
            busType: bus.busType,
            route: `${route.departureLocation.name} → ${route.arrivalLocation.name}`,
            distance: route.distance,
            fare: calculatedFare,
            liveTracking: bus.liveTracking ? '✅' : '❌',
            reschedulable: bus.reschedulable ? '✅' : '❌'
          });
          console.log(`✅ Updated: ${bus.registrationNumber} - Route: ${route.departureLocation.name} → ${route.arrivalLocation.name} - Fare: ₹${calculatedFare}`);
        } else {
          console.log(`ℹ️  Skipped: ${bus.registrationNumber} - Already has fare: ₹${bus.fare}`);
        }
      } catch (error) {
        console.error(`❌ Error processing bus ${bus.registrationNumber}:`, error.message);
      }
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('🎉 Fare update completed!');
    console.log('═══════════════════════════════════════════════');
    console.log(`Updated: ${updatedCount} buses`);
    console.log(`Skipped: ${buses.length - updatedCount} buses (already have fares)\n`);

    if (updatedBuses.length > 0) {
      console.log('Updated Bus Details:');
      console.table(updatedBuses);
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error updating bus fares:', error);
    process.exit(1);
  }
}

// Run the update
updateBusFares();
