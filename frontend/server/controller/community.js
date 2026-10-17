const mongoose      = require('mongoose');
const Post          = require('../models/post');
const Comment       = require('../models/comment');
const ForumTopic    = require('../models/forumTopic');
const ModerationLog = require('../models/moderationLog');
const User          = require('../models/User');

// Helper to safely check MongoDB ObjectId
const isValidObjectId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

// ── Posts ─────────────────────────────────────────────────────────────────────

// GET /api/v1/community/posts?forumTopicId=&authorId=&sortBy=&page=1&limit=20
exports.getPosts = async (req, res) => {
  try {
    const { forumTopicId, authorId, sortBy, page = 1, limit = 20 } = req.query;
    const filter = { hidden: false };
    if (forumTopicId && isValidObjectId(forumTopicId)) {
      filter.forumTopicId = forumTopicId;
    }

    if (authorId) {
      const user = await User.findOne({
        $or: [
          { googleId: authorId },
          ...(isValidObjectId(authorId) ? [{ _id: authorId }] : [])
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
    return res.status(200).json({ posts, total, page: Number(page) });
  } catch (err) {
    console.error('getPosts error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /api/v1/community/posts/:id
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findById(id).lean();
    if (!post || post.hidden) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    return res.status(200).json(post);
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/posts (protected by verifiedGuard)
exports.createPost = async (req, res) => {
  try {
    const { userId, authorName, title, body, tags, forumTopicId, imageUrl } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and body are required' });
    }

    const post = await Post.create({
      authorId: userId,
      authorName: authorName || 'Anonymous',
      title: title.trim(),
      body: body.trim(),
      tags: tags || [],
      forumTopicId: (forumTopicId && isValidObjectId(forumTopicId)) ? forumTopicId : null,
      imageUrl: imageUrl || null,
    });

    if (forumTopicId && isValidObjectId(forumTopicId)) {
      await ForumTopic.findByIdAndUpdate(forumTopicId, { $inc: { postCount: 1 } });
    }

    return res.status(201).json(post);
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// PUT /api/v1/community/posts/:id (author only, protected by verifiedGuard)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || req.body?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findById(id);
    if (!post || post.hidden) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check author match (support both Google ID and User _id)
    const isOwner = post.authorId === userId || (req.verifiedUser && post.authorId === req.verifiedUser.googleId);
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only edit your own posts' });
    }

    const { title, body, tags, imageUrl } = req.body;
    if (title !== undefined) post.title = title.trim();
    if (body !== undefined) post.body = body.trim();
    if (tags !== undefined) post.tags = tags;
    if (imageUrl !== undefined) post.imageUrl = imageUrl;

    await post.save();
    return res.status(200).json(post);
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// DELETE /api/v1/community/posts/:id (author only, soft delete)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check author match
    const isOwner = post.authorId === userId;
    if (!isOwner) {
      // Check if user object ID or Google ID matches
      const user = await User.findOne({
        $or: [
          { googleId: userId },
          ...(isValidObjectId(userId) ? [{ _id: userId }] : [])
        ]
      }).select('_id googleId').lean().exec();

      const matched = user && (post.authorId === user.googleId || post.authorId === user._id.toString());
      if (!matched) {
        return res.status(403).json({ success: false, message: 'Forbidden: You can only delete your own posts' });
      }
    }

    post.hidden = true;
    await post.save();
    return res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/posts/:id/like
exports.likePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findById(id);
    if (!post || post.hidden) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const idx = post.likes.indexOf(userId);
    if (idx === -1) {
      post.likes.push(userId);
    } else {
      post.likes.splice(idx, 1); // toggle unlike
    }
    await post.save();
    return res.status(200).json({ likes: post.likes.length, isLiked: idx === -1 });
  } catch (err) {
    console.error('likePost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/posts/:id/report
exports.reportPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (userId && !post.reportedBy.includes(userId)) {
      post.reportedBy.push(userId);
      await post.save(); // pre-save hook handles auto-hide at >= 5 reports
    }

    return res.status(200).json({ reports: post.reportedBy.length, hidden: post.hidden });
  } catch (err) {
    console.error('reportPost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/posts/:id/share
exports.sharePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { shareCount: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    return res.status(200).json({ shareCount: post.shareCount });
  } catch (err) {
    console.error('sharePost error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Comments ──────────────────────────────────────────────────────────────────

// GET /api/v1/community/comments?postId=xxx
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.query;
    if (!postId || !isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Valid postId is required' });
    }

    const comments = await Comment.find({ postId, hidden: false })
      .sort({ createdAt: 1 })
      .lean();
    return res.status(200).json(comments);
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/comments (protected by verifiedGuard)
exports.createComment = async (req, res) => {
  try {
    const { userId, authorName, postId, body } = req.body;
    if (!body?.trim() || !postId) {
      return res.status(400).json({ success: false, message: 'Body and postId are required' });
    }

    if (!isValidObjectId(postId)) {
      return res.status(400).json({ success: false, message: 'Invalid postId' });
    }

    const comment = await Comment.create({
      postId,
      authorId: userId,
      authorName: authorName || 'Anonymous',
      body: body.trim(),
    });
    return res.status(201).json(comment);
  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/comments/:id/report
exports.reportComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (userId && !comment.reportedBy.includes(userId)) {
      comment.reportedBy.push(userId);
      await comment.save();
    }
    return res.status(200).json({ reports: comment.reportedBy.length, hidden: comment.hidden });
  } catch (err) {
    console.error('reportComment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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
    return res.status(200).json(topics);
  } catch (err) {
    console.error('getTopics error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/v1/community/topics (protected by verifiedGuard)
exports.createTopic = async (req, res) => {
  try {
    const { userId, title, description } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'Topic title is required' });
    }

    const topic = await ForumTopic.create({
      title: title.trim(),
      description: (description || '').trim(),
      createdBy: userId,
    });
    return res.status(201).json(topic);
  } catch (err) {
    console.error('createTopic error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ── Moderation ────────────────────────────────────────────────────────────────

// POST /api/v1/community/moderate
exports.moderate = async (req, res) => {
  try {
    const { moderatorId, targetType, targetId, action, reason } = req.body;
    if (!moderatorId || !targetType || !targetId || !action) {
      return res.status(400).json({ success: false, message: 'Missing moderation parameters' });
    }

    if (!isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid targetId' });
    }

    const Model = targetType === 'post' ? Post : Comment;
    const hidden = action === 'hide' || action === 'delete';
    await Model.findByIdAndUpdate(targetId, { hidden });
    await ModerationLog.create({
      moderatorId,
      targetType,
      targetId,
      action,
      reason: reason || '',
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('moderate error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
