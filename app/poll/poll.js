const eb = require('app/eventBus');
const Promise = require('bluebird');
const mongoose = Promise.promisifyAll(require('mongoose'));
const Schema = mongoose.Schema;

const PollSchema = new Schema({

  createdBy: {
    userId: { type: Schema.Types.ObjectId, required: '{PATH} is required!' },
    name: { type: String, required: '{PATH} is required!' },
    picture: { type: String }
  },

  question: { type: String, default: '' },
  answer1: {
    text: { type: String, default: '' },
    numVotes: { type: Number, default: 0 },
    picture: { type: String, default: '' },
    voters: [ Schema.Types.ObjectId ],
  },
  answer2: {
    text: { type: String, default: '' },
    numVotes: { type: Number, default: 0 },
    picture: { type: String, default: '' },
    voters: [ Schema.Types.ObjectId ],
  },

  subscribers: [ Schema.Types.ObjectId ],

  numComments: { type: Number, default: 0 },
  comments: [{
    createdBy: {
      userId: { type: Schema.Types.ObjectId },
      name: { type: String },
      picture: { type: String }
    },
    text: { type: String, default: '' }
  }],

});

// Indexes
PollSchema.index({'createdBy.userId': 1, '_id': -1 });
PollSchema.index({'comments.createdBy.userId': 1});
PollSchema.index({'subscribers': 1});

// Add toJSON option to transform document before returnig the result
PollSchema.options.toJSON = {
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret._random;
    delete ret.__v;
  }
};

// Static methods
PollSchema.statics.publish = function (user, data = {}) {
  const pollData = {
    question: data.question,
    answer1: {
      text: data.answer1 && data.answer1.text,
      picture: data.answer1 && data.answer1.picture
    },
    answer2: {
      text: data.answer2 && data.answer2.text,
      picture: data.answer2 && data.answer2.picture
    },
    subscribers: [ user.id ],
    createdBy: {
      name: user.name,
      userId: user.id,
      picture: user.picture
    }
  };
  return this.createAsync(pollData).then(function (poll) {
    setImmediate(function () {
      eb.emit('pollModel:publish', { user: user, poll: poll });
    });
    return poll;
  });
};

PollSchema.statics.getByUserId = function (userId, pollId, limit) {
  const query = { 'createdBy.userId': userId };
  const projection = {
    'answer1.voters': 0,
    'answer2.voters': 0,
    'comments': 0,
    'votes': 0
  };
  const options = { sort: { '_id': -1 } };

  if (limit > 0) {
    options.limit = limit;
  }
  if (pollId) {
    query._id = { $lt: pollId };
  }

  return this.findAsync(query, projection, options);
};

// remove sub arrays. use findByIdAsync to retrieve with sub arrays
PollSchema.statics.getById = function (pollId) {
  const projection = '-answer1.voters -answer2.voters -subscribers -comments';
  return this.findByIdAsync(pollId, projection);
};

PollSchema.statics.voteAnswer = function (pollId, voterId, answerNumber) {
  const query = {
    '_id': pollId,
    'answer1.voters': { $ne: voterId },
    'answer2.voters': { $ne: voterId }
  };
  const update = { $inc: {}, $addToSet: {} };

  if (answerNumber !== 1 && answerNumber !== 2) {
    return Promise.reject(
      new Error('Invalid answer: answer must be either number 1 or 2')
    );
  }

  update.$inc['answer' + answerNumber + '.numVotes'] = 1;
  update.$addToSet['answer' + answerNumber + '.voters'] = voterId;

  return this.findOneAndUpdateAsync(query, update, {'new': true}).then(function (poll) {
    if (poll) {
      setImmediate(function () {
        eb.emit('pollModel:vote', {
          userId: voterId,
          poll: poll,
          answer: answerNumber
        });
      });
    }
    return poll;
  });
};

PollSchema.statics.comment = function (pollId, user, text) {
  const comment = {
    'createdBy': {
      userId: user.id,
      name: user.name,
      picture: user.picture
    },
    'text': text
  };
  const update = {
    '$addToSet': {
      'subscribers': user.id
    },
    '$push': {
      'comments': comment,
    },
    '$inc': {
      'numComments': 1
    }
  };
  return this.findByIdAndUpdateAsync(pollId, update, {'new': true}).then(function (poll) {
    if (poll) {
      setImmediate(function () {
        eb.emit('pollModel:comment', { userId: user.id, poll: poll });
      });
    }
    return poll;
  });
};

PollSchema.statics.getComments = function (pollId, {
    skip = 0,
    limit = 100
  } = {}) {
  const project = {
    'comments': { $slice: [ skip, limit ] }
  };
  return this.findByIdAsync(pollId, project).then(function (poll) {
    return poll ? poll.comments : [];
  });
};

// TODO: test this
PollSchema.statics.getRecentUnvoted = function (user, beforePollId, exclude) {
  const userId = mongoose.Types.ObjectId(user.id);
  const query = {
    'answer1.voters': { $ne: userId },
    'answer2.voters': { $ne: userId }
  };
  if (exclude.length > 1) {
    query._id = { $nin: exclude.map(id => mongoose.Types.ObjectId(id)) };
  }
  if (beforePollId) {
    query._id = { $lt: mongoose.Types.ObjectId(beforePollId) };
  }
  return this.aggregateAsync([
    { $sort: { '_id': -1 }},
    { $limit: 1000 },
    { $match: query },
    { $limit: 20 },
    { $project: {
      'id': '$_id',
      '_id': 0,
      'createdBy': 1,
      'question': 1,
      'answer1.text': 1,
      'answer1.picture': 1,
      'answer1.numVotes': 1,
      'answer2.text': 1,
      'answer2.picture': 1,
      'answer2.numVotes': 1,
      'totalNumVotes': 1,
      'numComments': 1
    } }
  ]);
};

module.exports = mongoose.model('Poll', PollSchema);
