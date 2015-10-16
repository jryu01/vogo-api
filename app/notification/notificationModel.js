'use strict';

const Promise = require('bluebird');
const mongoose = Promise.promisifyAll(require('mongoose'));
const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  verb: { type: String }, // comment, vote, follow, join,
  objectType: { type: String },
  object: { type: Schema.Types.ObjectId },
  detail: {},
  // createdAt: { type: Date, default: Date.now, expires: 60 }
  updatedAt: { type: Date, default: Date.now, expires: '30d' },
  read: { type: Boolean, default: false }
});

NotificationSchema.index({'user': 1, 'updatedAt': -1});
NotificationSchema.index({'user': 1, 'object': 1});

module.exports = mongoose.model('Notification', NotificationSchema);
