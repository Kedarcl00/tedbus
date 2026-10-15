const Post          = require('../models/post');
const Comment       = require('../models/comment');
const ForumTopic    = require('../models/forumTopic');
const ModerationLog = require('../models/moderationLog');
const User          = require('../models/User');

// ── Posts ─────────────────────────────────────────────────────────────────────

// GET /api/v1/community/posts?forumTopicId=&authorId=&sortBy=&page=1&limit=20
exports.getPosts = async (req, res) => {
  try {
    const { forumTopicId, authorId, sortBy, page = 1, limit = 20 } = req.query;
    const filter = { hidden: false };
    if (forumTopicId) filter.forumTopicId = forumTopicId;

    if (authorId) {
      const isObjectId = typeof authorId === 'string' && /^[0-9a-fA-F]{24}$/.test(authorId);
      const user = await User.findOne({
        $or: [
          { googleId: authorId },
          ...(isObjectId ? [{ _id: authorId }] : [])
        ]
      }).select('_id googleId').lean().exec();

      if (user) {
        filter.$or = [
          { authorId: authorId },
          { authorId: user.googleId },
          { authorId: user._id.toString() }
        ];
      } else {
        filter.authorId = authorId;
      }
    }

    let posts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    if (sortBy === 'popular') {
      posts.sort((a, b) => {
        const scoreA = (a.likes?.length || 0) * 2 + (a.shareCount || 0);
        const scoreB = (b.likes?.length || 0) * 2 + (b.shareCount || 0);
        return scoreB - scoreA;
      });
    }

    const total = await Post.countDocuments(filter);
    res.json({ posts, total, page: Number(page) });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/posts  (protected by verifiedGuard)
exports.createPost = async (req, res) => {
  try {
    const { userId, authorName, title, body, tags, forumTopicId, imageUrl } = req.body;
    if (!title?.trim() || !body?.trim()) return res.sendError('VALIDATION', 400);
    const post = await Post.create({
      authorId: userId, authorName, title, body,
      tags: tags || [], forumTopicId: forumTopicId || null,
      imageUrl: imageUrl || null,
    });
    if (forumTopicId) {
      await ForumTopic.findByIdAndUpdate(forumTopicId, { $inc: { postCount: 1 } });
    }
    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/posts/:id/like
exports.likePost = async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.sendError('NOT_FOUND', 404);
    const idx = post.likes.indexOf(userId);
    if (idx === -1) post.likes.push(userId);
    else post.likes.splice(idx, 1);       // toggle unlike
    await post.save();
    res.json({ likes: post.likes.length });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/posts/:id/report
exports.reportPost = async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.sendError('NOT_FOUND', 404);
    if (!post.reportedBy.includes(userId)) {
      post.reportedBy.push(userId);
      await post.save();   // pre-save hook handles auto-hide at >= 5 reports
    }
    res.json({ reports: post.reportedBy.length, hidden: post.hidden });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/posts/:id/share
exports.sharePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id, { $inc: { shareCount: 1 } }, { new: true }
    );
    if (!post) return res.sendError('NOT_FOUND', 404);
    res.json({ shareCount: post.shareCount });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// PUT /api/v1/community/posts/:id  (author only, protected by verifiedGuard)
exports.updatePost = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    
    const post = await Post.findById(req.params.id);
    if (!post) return res.sendError('NOT_FOUND', 404);
    
    // Authorization: only the author can edit
    if (post.authorId !== userId) return res.sendError('FORBIDDEN', 403);
    
    const { title, body, tags, imageUrl } = req.body;
    if (title !== undefined) post.title = title.trim();
    if (body !== undefined) post.body = body.trim();
    if (tags !== undefined) post.tags = tags;
    if (imageUrl !== undefined) post.imageUrl = imageUrl;
    
    // TODO: Future enhancement - restrict editing to 24 hours after creation
    // const hoursSinceCreation = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
    // if (hoursSinceCreation > 24) return res.sendError('EDIT_WINDOW_EXPIRED', 403);
    
    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// DELETE /api/v1/community/posts/:id  (author only, soft delete)
exports.deletePost = async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.sendError('UNAUTHORIZED', 401);
    
    const post = await Post.findById(req.params.id);
    if (!post) return res.sendError('NOT_FOUND', 404);
    
    // Authorization: only the author can delete
    if (post.authorId !== userId) return res.sendError('FORBIDDEN', 403);
    
    // Soft delete by setting hidden to true
    post.hidden = true;
    await post.save();
    
    res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// ── Comments ──────────────────────────────────────────────────────────────────

// GET /api/v1/community/comments?postId=xxx
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.query;
    if (!postId) return res.sendError('VALIDATION', 400);
    const comments = await Comment.find({ postId, hidden: false })
      .sort({ createdAt: 1 })
      .lean();
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/comments  (protected by verifiedGuard)
exports.createComment = async (req, res) => {
  try {
    const { userId, authorName, postId, body } = req.body;
    if (!body?.trim()) return res.sendError('VALIDATION', 400);
    const comment = await Comment.create({
      postId, authorId: userId, authorName, body,
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/comments/:id/report
exports.reportComment = async (req, res) => {
  try {
    const { userId } = req.body;
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.sendError('NOT_FOUND', 404);
    if (!comment.reportedBy.includes(userId)) {
      comment.reportedBy.push(userId);
      await comment.save();
    }
    res.json({ reports: comment.reportedBy.length, hidden: comment.hidden });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// ── Forum Topics ──────────────────────────────────────────────────────────────

// GET /api/v1/community/topics
exports.getTopics = async (req, res) => {
  try {
    let topics = await ForumTopic.find().sort({ pinned: -1, createdAt: -1 }).lean();
    if (!topics || topics.length === 0) {
      const defaultTopics = [
        { title: 'Routes & Journeys', description: 'Discuss popular bus routes, stops, road conditions, and scenic highlights.', pinned: true, createdBy: 'system' },
        { title: 'Destinations & Sightseeing', description: 'City travel guides, must-visit tourist destinations, and local food spots.', pinned: true, createdBy: 'system' },
        { title: 'Travel Advice & Tips', description: 'Packing essentials, luggage policies, safety advice, and booking tips.', pinned: false, createdBy: 'system' },
        { title: 'Bus Journey Stories', description: 'Share memorable travel stories, bus reviews, photos, and road experiences.', pinned: false, createdBy: 'system' },
      ];
      await ForumTopic.insertMany(defaultTopics);
      topics = await ForumTopic.find().sort({ pinned: -1, createdAt: -1 }).lean();
    }
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// POST /api/v1/community/topics  (protected by verifiedGuard)
exports.createTopic = async (req, res) => {
  try {
    const { userId, title, description } = req.body;
    if (!title?.trim()) return res.sendError('VALIDATION', 400);
    const topic = await ForumTopic.create({ title, description, createdBy: userId });
    res.status(201).json(topic);
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};

// ── Moderation ────────────────────────────────────────────────────────────────

// POST /api/v1/community/moderate
exports.moderate = async (req, res) => {
  try {
    const { moderatorId, targetType, targetId, action, reason } = req.body;
    if (!moderatorId || !targetType || !targetId || !action) {
      return res.sendError('VALIDATION', 400);
    }
    const Model = targetType === 'post' ? Post : Comment;
    const hidden = action === 'hide' || action === 'delete';
    await Model.findByIdAndUpdate(targetId, { hidden });
    await ModerationLog.create({ moderatorId, targetType, targetId, action, reason: reason || '' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.sendError('SERVER_ERROR', 500);
  }
};
