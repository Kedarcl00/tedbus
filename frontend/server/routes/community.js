const express       = require('express');
const router        = express.Router();
const ctrl          = require('../controller/community');
const verifiedGuard = require('../middleware/verifiedGuard');

// Posts
router.get('/api/v1/community/posts',              ctrl.getPosts);
router.post('/api/v1/community/posts',             verifiedGuard, ctrl.createPost);
router.put('/api/v1/community/posts/:id',          verifiedGuard, ctrl.updatePost);
router.delete('/api/v1/community/posts/:id',       ctrl.deletePost);
router.post('/api/v1/community/posts/:id/like',    ctrl.likePost);
router.post('/api/v1/community/posts/:id/report',  ctrl.reportPost);
router.post('/api/v1/community/posts/:id/share',   ctrl.sharePost);

// Comments
router.get('/api/v1/community/comments',              ctrl.getComments);
router.post('/api/v1/community/comments',             verifiedGuard, ctrl.createComment);
router.post('/api/v1/community/comments/:id/report',  ctrl.reportComment);

// Forum Topics
router.get('/api/v1/community/topics',   ctrl.getTopics);
router.post('/api/v1/community/topics',  verifiedGuard, ctrl.createTopic);

// Moderation
router.post('/api/v1/community/moderate', ctrl.moderate);

module.exports = router;
