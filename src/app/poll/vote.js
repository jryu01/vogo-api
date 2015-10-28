import Promise from 'bluebird';
import Poll from './poll';

const mongoose = Promise.promisifyAll(require('mongoose'));
const Schema = mongoose.Schema;

const VoteSchema = new Schema({
  _user: { type: Schema.Types.ObjectId, ref: 'User' },
  answer: { type: Number },
  _poll: { type: Schema.Types.ObjectId, ref: 'Poll' }
});

VoteSchema.index({'_user': 1, '_id': -1});
VoteSchema.index({'_poll': -1, '_id': -1});

VoteSchema.statics.createNew = function (userId, pollId, answer) {
  const that = this;
  const vote = {
    _user: userId,
    answer: answer,
    _poll: pollId,
  };
  const promise = Poll.voteAnswer(pollId, userId, answer).then(function (poll) {
    if (!poll) { return null; }
    return that.createAsync(vote);
  });
  return promise;
};

VoteSchema.statics.getByUserId = function (userId, voteId, limit) {
  const query = { '_user': userId };
  const options = { sort: { '_id': -1 } };

  if (limit > 0) {
    options.limit = limit;
  }
  if (voteId) {
    query._id = { $lt: voteId };
  }

  return this.find(query, null, options)
    .populate('_poll', '-answer1.voters -answer2.voters -comments -votes').execAsync();
};

VoteSchema.statics.getByUserIdAndPollIds = function (userId, pollIds) {
  const query = {
    '_poll': { '$in': pollIds },
    '_user': userId
  };
  return this.findAsync(query);
};

VoteSchema.statics.getVotersFor = function (pollId, answer, options = {}) {
  const query = { '_poll': pollId, 'answer': answer };
  options.sort = { '_id': -1 };

  const mapToUsers = votes => votes.map(vote => vote._user);

  return this.find(query, null, options)
    .populate('_user', '-followers')
    .execAsync()
    .then(mapToUsers);
};

// VoteSchema.statics.getByPollId = function (pollId, voteId, limit) {};

// Add toJSON option to transform document before returnig the result
VoteSchema.options.toJSON = {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
};

export default mongoose.model('Vote', VoteSchema);
