'use strict';

var Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require("mongoose")),
    Poll = require('./poll'),
    Schema = mongoose.Schema;
 
var VoteSchema = new Schema({
  voterId: { type: Schema.Types.ObjectId },
  answer: { type: Number },
  _poll: { type: Schema.Types.ObjectId, ref: 'Poll' }
});

VoteSchema.index({'voterId': 1, '_id': -1 });
VoteSchema.index({'poll.id': 1});

VoteSchema.statics.createNew = function (voterId, pollId, answer) {
  var that = this;
  var vote = {
    voterId: voterId,
    answer: answer,
    _poll: pollId,
  };
  var promise = Poll.voteAnswer(pollId, voterId, answer).then(function (poll) {
    if (!poll) { return null; }
    return that.createAsync(vote);
  });
  return promise;
};

VoteSchema.statics.getByUserId = function (voterId, voteId, limit) {
  var query = { 'voterId': voterId },
      options = { sort: { '_id': -1 } };
      options = {};

  if (limit > 0) {
    options.limit = limit; 
  }   
  if (voteId) {
    query._id = { $lt: voteId };
  }

  return this.find(query, null, options)
    .populate('_poll', 'question').execAsync();
};

module.exports = mongoose.model('Vote', VoteSchema);