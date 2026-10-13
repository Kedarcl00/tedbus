const mongoose = require('mongoose');
const { Schema } = mongoose;

const moderationLogSchema = new Schema({
  moderatorId: { type: String, required: true },
  targetType:  { type: String, enum: ['post', 'comment'], required: true },
  targetId:    { type: Schema.Types.ObjectId, required: true },
  action:      { type: String, enum: ['hide', 'unhide', 'delete', 'warn'], required: true },
  reason:      { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
