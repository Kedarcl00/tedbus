const mongoose = require('mongoose');
const { Schema } = mongoose;

const commentSchema = new Schema({
  postId:     { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  authorId:   { type: String, required: true },
  authorName: { type: String, required: true },
  body:       { type: String, required: true },
  reportedBy: { type: [String], default: [] },
  hidden:     { type: Boolean, default: false },
  createdAt:  { type: Date, default: Date.now },
});

commentSchema.pre('save', function (next) {
  if (this.reportedBy.length >= 5) this.hidden = true;
  next();
});

module.exports = mongoose.model('Comment', commentSchema);
