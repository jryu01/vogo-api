'use strict';

var Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require("mongoose")),
    Poll = require('./poll'),
    Schema = mongoose.Schema;
 
var NotificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  verb: { type: String }, // commented, voted, followed, joined, 
  objectType: { type: String },
  objectId: { type: Schema.Types.ObjectId },
  data: {},
  // createdAt: { type: Date, default: Date.now, expires: 60 }
  createdAt: { type: Date, expires: '30d' }
});

NotificationSchema.index({'userId': 1, 'createdAt': -1});