const express=require("express")
const router=express.Router();
const bookingController=require("../controller/booking")

router.post("/booking",bookingController.addbooking);
router.get("/booking/:id",bookingController.getBooking);

// New API routes with /api prefix
router.get("/api/bookings/my", bookingController.getMyBookings);
router.post("/api/bookings", bookingController.createBooking);
router.get("/api/bookings/:id", bookingController.getBookingById);

module.exports=router;