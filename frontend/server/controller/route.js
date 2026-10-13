const Route = require('../models/route');
const Bus = require('../models/bus');
const Booking = require('../models/booking');

exports.getoneroute = async (req, res) => {
  try {
    const { departure, arrival, date } = req.params;

    const routes = await Route.find().lean().exec();
    const route = routes.find(
      r =>
        r.departureLocation.name.toLowerCase() === departure.toLowerCase() &&
        r.arrivalLocation.name.toLowerCase() === arrival.toLowerCase()
    );

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const buses = await Bus.find().lean().exec();
    const matchedbuses = buses.filter(
      bus => bus.routes && bus.routes.toString() === route._id.toString()
    );

    const bookings = await Booking.find().lean().exec();
    const busidwithseatobj = {};

    // Transform buses to include fare and parsed duration
    const transformedBuses = matchedbuses.map(bus => {
      // Parse duration string to numeric hours
      let durationHours = 0;
      if (bus.duration) {
        if (typeof bus.duration === 'number') {
          durationHours = bus.duration;
        } else if (typeof bus.duration === 'string') {
          // Parse "10h 30m" or "10h" format
          const hourMatch = bus.duration.match(/(\d+)h/);
          const minuteMatch = bus.duration.match(/(\d+)m/);
          const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
          const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
          durationHours = hours + (minutes / 60);
        }
      }

      return {
        ...bus,
        fare: bus.fare || 0, // Use fare field from bus document
        durationHours, // Add numeric duration for calculations
        arrivalTime: bus.arrivalTime,
      };
    });

    for (const bus of transformedBuses) {
      const busbookings = bookings.filter(
        booking =>
          (booking.departureDate && new Date(booking.departureDate).toISOString().split('T')[0] === date) &&
          booking.busId.toString() === bus._id.toString()
      );
      const bookedSeats = busbookings.flatMap(booking => booking.seats);
      busidwithseatobj[bus._id.toString()] = bookedSeats;
    }

    res.json({ route, matchedBuses: transformedBuses, busidwithseatobj });
  } catch (error) {
    console.error('Error fetching route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
