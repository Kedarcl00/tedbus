/**
 * Database Seeding Script for TedBus
 * 
 * Populates MongoDB with sample routes and buses for testing
 * Run: node seed-database.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Route = require('./models/route');
const Bus = require('./models/bus');

// MongoDB connection - Use cloud Atlas URI from .env
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tedbus';

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing routes and buses...');
    await Route.deleteMany({});
    await Bus.deleteMany({});
    console.log('✅ Cleared existing data\n');

    // Seed Routes
    console.log('🚌 Creating routes...');
    const routes = [
      {
        departureLocation: {
          name: 'Mumbai',
          address: 'Mumbai Central Bus Station',
          city: 'Mumbai',
          state: 'Maharashtra',
        },
        arrivalLocation: {
          name: 'Goa',
          address: 'Panaji Bus Stand',
          city: 'Panaji',
          state: 'Goa',
        },
        distance: 580,
        duration: '10 hours 30 minutes',
        fare: 1200,
      },
      {
        departureLocation: {
          name: 'Delhi',
          address: 'Kashmere Gate ISBT',
          city: 'Delhi',
          state: 'Delhi',
        },
        arrivalLocation: {
          name: 'Jaipur',
          address: 'Sindhi Camp Bus Stand',
          city: 'Jaipur',
          state: 'Rajasthan',
        },
        distance: 280,
        duration: '5 hours 30 minutes',
        fare: 600,
      },
      {
        departureLocation: {
          name: 'Bangalore',
          address: 'Kempegowda Bus Station',
          city: 'Bangalore',
          state: 'Karnataka',
        },
        arrivalLocation: {
          name: 'Mysore',
          address: 'Mysore Bus Stand',
          city: 'Mysore',
          state: 'Karnataka',
        },
        distance: 150,
        duration: '3 hours',
        fare: 400,
      },
      {
        departureLocation: {
          name: 'Kolkata',
          address: 'Esplanade Bus Terminus',
          city: 'Kolkata',
          state: 'West Bengal',
        },
        arrivalLocation: {
          name: 'Darjeeling',
          address: 'Darjeeling Bus Stand',
          city: 'Darjeeling',
          state: 'West Bengal',
        },
        distance: 620,
        duration: '12 hours',
        fare: 1000,
      },
      {
        departureLocation: {
          name: 'Chennai',
          address: 'CMBT Bus Terminal',
          city: 'Chennai',
          state: 'Tamil Nadu',
        },
        arrivalLocation: {
          name: 'Pondicherry',
          address: 'Pondicherry Bus Stand',
          city: 'Pondicherry',
          state: 'Pondicherry',
        },
        distance: 170,
        duration: '3 hours 30 minutes',
        fare: 450,
      },
    ];

    const createdRoutes = await Route.insertMany(routes);
    console.log(`✅ Created ${createdRoutes.length} routes\n`);

    // Seed Buses
    console.log('🚍 Creating buses...');
    const buses = [];

    // Bus types (matching schema enum: AC, non-AC, Sleeper, Premium)
    const busTypes = ['AC', 'non-AC', 'Sleeper', 'Premium'];
    const operators = [
      'Royal Travels',
      'VRL Travels',
      'Orange Travels',
      'SRS Travels',
      'Kallada Travels',
      'Parveen Travels',
      'Neeta Travels',
      'Paulo Travels',
    ];

    // Create 2-3 buses for each route
    let busCounter = 1;
    for (const route of createdRoutes) {
      const numBuses = 2 + Math.floor(Math.random() * 2); // 2-3 buses per route
      
      // Extract distance from route
      const distance = route.distance;
      
      for (let i = 0; i < numBuses; i++) {
        const busType = busTypes[Math.floor(Math.random() * busTypes.length)];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        
        const totalSeats = busType === 'Sleeper' ? 40 : 50;
        
        // Generate unique registration number
        const regNumber = `MH${busCounter.toString().padStart(2, '0')}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}`;
        busCounter++;
        
        // Generate departure time (between 18:00 and 23:00)
        const departureHour = 18 + (i * 2);
        const departureMinute = Math.floor(Math.random() * 60);
        const departureTime = `${departureHour.toString().padStart(2, '0')}:${departureMinute.toString().padStart(2, '0')}`;
        
        // Calculate arrival time based on route duration
        const durationMatch = route.duration.match(/(\d+)/);
        const durationHours = durationMatch ? parseInt(durationMatch[0]) : 6;
        const arrivalHour = (departureHour + durationHours) % 24;
        const arrivalMinute = departureMinute;
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${arrivalMinute.toString().padStart(2, '0')}`;
        
        // Calculate fare based on distance, bus type, and facilities
        let baseFarePerKm = 1.5; // Base fare in INR per km
        
        // Bus type multipliers
        const busTypeMultiplier = {
          'AC': 2.0,
          'Premium': 2.5,
          'Sleeper': 1.8,
          'non-AC': 1.0
        };
        
        const typeMultiplier = busTypeMultiplier[busType] || 1.0;
        
        // Facility additions
        const hasLiveTracking = Math.random() > 0.5 ? 1 : 0;
        const hasReschedulable = Math.random() > 0.5 ? 1 : 0;
        
        let facilityAddition = 0;
        if (hasLiveTracking) facilityAddition += 50; // ₹50 for live tracking
        if (hasReschedulable) facilityAddition += 30; // ₹30 for reschedulable
        
        // Calculate total fare: (distance * baseFarePerKm * typeMultiplier) + facilities
        const calculatedFare = Math.round((distance * baseFarePerKm * typeMultiplier) + facilityAddition);
        
        buses.push({
          operatorName: operator,
          busType: busType,
          totalSeats: totalSeats,
          registrationNumber: regNumber,
          departureTime: departureTime,
          arrivalTime: arrivalTime,
          fare: calculatedFare,
          rating: [4, 5, 3, 4, 5],  // Sample ratings
          liveTracking: hasLiveTracking,
          reschedulable: hasReschedulable,
          amenities: [
            busType === 'AC' || busType === 'Premium' ? 'Air Conditioning' : 'Fan',
            busType === 'Sleeper' ? 'Sleeper Berths' : 'Push Back Seats',
            'Water Bottle',
            'Charging Point',
            'Reading Light',
            'Emergency Exit',
          ],
          routes: route._id,
        });
      }
    }

    const createdBuses = await Bus.insertMany(buses);
    console.log(`✅ Created ${createdBuses.length} buses\n`);

    // Print summary
    console.log('═══════════════════════════════════════════════');
    console.log('🎉 Database seeding completed successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Routes created: ${createdRoutes.length}`);
    console.log(`🚌 Buses created: ${createdBuses.length}`);
    console.log('═══════════════════════════════════════════════\n');
    
    console.log('Available routes:');
    createdRoutes.forEach((route, index) => {
      const busCount = createdBuses.filter(
        bus => bus.routes.toString() === route._id.toString()
      ).length;
      console.log(`  ${index + 1}. ${route.departureLocation.name} → ${route.arrivalLocation.name} (${busCount} buses)`);
    });
    
    console.log('\n✅ You can now test the application!');
    console.log('   Example search: Mumbai → Goa, any future date\n');

    // Close connection
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
