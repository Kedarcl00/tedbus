const mongoose = require('mongoose');
const { Schema } = mongoose;

const forumTopicSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  createdBy:   { type: String, required: true },
  pinned:      { type: Boolean, default: false },
  postCount:   { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('ForumTopic', forumTopicSchema);
