const express = require('express');
const router  = express.Router();
const ctrl    = require('../controller/notification');

router.get('/api/v1/notifications',             ctrl.getNotifications);
router.post('/api/v1/notifications',            ctrl.createNotification);
router.patch('/api/v1/notifications/read',      ctrl.markAllRead);
router.get('/api/v1/notifications/preferences', ctrl.getPreferences);
router.put('/api/v1/notifications/preferences', ctrl.savePreferences);

module.exports = router;
