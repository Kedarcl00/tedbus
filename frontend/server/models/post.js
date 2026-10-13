const mongoose = require('mongoose');
const { Schema } = mongoose;

const postSchema = new Schema({
  authorId:    { type: String, required: true, index: true },
  authorName:  { type: String, required: true },
  title:       { type: String, required: true, trim: true },
  body:        { type: String, required: true },
  tags:        { type: [String], default: [] },
  imageUrl:    { type: String, default: null },        // optional image URL
  likes:       { type: [String], default: [] },       // array of userIds
  reportedBy:  { type: [String], default: [] },       // array of userIds
  hidden:      { type: Boolean, default: false },     // auto-hidden when reports >= 5
  shareCount:  { type: Number, default: 0 },
  forumTopicId:{ type: Schema.Types.ObjectId, ref: 'ForumTopic', default: null },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

// Auto-hide when report count reaches threshold
postSchema.pre('save', function (next) {
  if (this.reportedBy.length >= 5) this.hidden = true;
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Post', postSchema);
