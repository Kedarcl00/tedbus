/**
 * Review Routes - Endpoints for verified post-journey ratings and reviews
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controller/review');

router.post('/api/reviews', ctrl.submitReview);
router.put('/api/reviews/:id', ctrl.editReview);
router.delete('/api/reviews/:id', ctrl.deleteReview);
router.get('/api/reviews/bus/:busId', ctrl.getBusReviews);
router.get('/api/reviews/route/:routeId', ctrl.getRouteReviews);
router.get('/api/reviews/booking/:bookingId', ctrl.getBookingReview);
router.post('/api/reviews/:id/helpful', ctrl.markHelpful);
router.post('/api/reviews/:id/report', ctrl.reportReview);
router.post('/api/reviews/:id/moderate', ctrl.moderateReview);

module.exports = router;
