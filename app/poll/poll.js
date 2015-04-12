'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require("mongoose")),
    Schema = mongoose.Schema;
 
var PollSchema = new Schema({

  createdBy: {
    userId: { type: Schema.Types.ObjectId, required: '{PATH} is required!' },
    name: { type: String, required: '{PATH} is required!' },
    picture: { type: String }
  },
  createdAt: { type: Date, default: Date.now }, //will be depreciated
  // updatedAt change when new vote or new comments are added 
  updatedAt: { type: Date, default: Date.now },

  // will be removed
  subject1: {
    text: { type: String },
    numVotes: { type: Number, default: 0 }
  },
  subject2: {
    text: { type: String },
    numVotes: { type: Number, default: 0 }
  },
  subjectTexts: [],
  /////////////////////

  //// added /////
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
  //////////

  totalNumVotes: { type: Number, default: 0 }, // be removed (total: a1 + a2)
  votes: [{
    voterId: { type: Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now }, //will be removed
    subjectId: { type: Number }, //will be removed
    subjectText: { type: String }, //will be removed
    answer: { type: Number },
    answerText : { type: String }
  }],

  numComments: { type: Number, default: 0 },
  comments: [{
    createdBy: {
      userId: { type: Schema.Types.ObjectId },
      name: { type: String },
      picture: { type: String }
    },
    text: String
  }],

  tags: [String],

  _random: { type: Number, default: Math.random }
});

// Indexes
PollSchema.index({'votes.voterId': 1, '_random': 1});
PollSchema.index({'votes.voterId': 1, '_id': -1, '_random': 1});
PollSchema.index({'votes.voterId': 1, 'votes.createdAt': -1 });
PollSchema.index({'createdBy.userId': 1, 'updatedAt': -1 });

PollSchema.index({'createdBy.userId': 1, '_id': -1 });

//Add toJSON option to transform document before returnig the result
PollSchema.options.toJSON = {
  transform: function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
    delete ret._random;
    delete ret.__v;
  }
};

// Static methods
PollSchema.statics.publish = function (user, data) {
  data = data || {};
  data.createdBy = {
    name: user.name,
    userId: user.id,
    picture: user.picture
  };
  return this.createAsync(data);
};

PollSchema.statics.getByUserId = function (userId, pollId, limit) {
  var query = { 'createdBy.userId': userId },
      projection = {},
      options = { sort: { '_id': -1 } };

  if (limit > 0) {
    options.limit = limit; 
  }   
  if (pollId) {
    query._id = { $lt: pollId };
  }

  return this.findAsync(query, projection, options);
};

PollSchema.statics.getById = function (pollId) {
  return this.findByIdAsync(pollId);
};

PollSchema.statics.voteAnswer = function (pollId, voterId, answer) {
  var query = { 
    '_id': pollId,
    'answer1.voters': { $ne: voterId },
    'answer2.voters': { $ne: voterId }
  };
  var update = { $inc: {}, $push: {} };

  if(answer !== 1 && answer !== 2) {
    return Promise.reject(
      new Error('Invalid answer: answer must be either number 1 or 2')
    );
  }

  update.$inc['answer' + answer + '.numVotes'] = 1;
  update.$push['answer'+ answer + '.voters'] = voterId;

  return this.findOneAndUpdateAsync(query, update).then(function () {});
};

// PollSchema.statics.getVotesByVoterId = function (voterId, voteId, limit) {

// };

PollSchema.statics.comment = function (pollId, userId, text) {
  //answer is either 1 or 2 to vote answer1 or answer2
};

PollSchema.statics.getComments = function (pollId, commentId, limit) {
  //answer is either 1 or 2 to vote answer1 or answer2
};



//VVVVVVVVVVVVVVVVVVVVVVVV Will be depreciated VVVVVVVVVVVVVVVVVVVVV
PollSchema.methods.addVote = function (voterId, subjectId) {
  var that = this;
  if (!(subjectId === 1 || subjectId === 2)) {
    return Promise
      .reject(new Error('argument subjectId must be an integer 1 or 2'));
  }
  this.totalNumVotes += 1;
  this['subject' + subjectId].numVotes += 1;
  this.votes.push({
    voterId: voterId,
    subjectId: subjectId,
    subjectText: this['subject' + subjectId].text 
  });
  return this.saveAsync().then(function (result) {
    return result[0];
  });
};

PollSchema.statics.createNew = function (data) {
  var text1 = data.subject1 && data.subject1.text,
      text2 = data.subject1 && data.subject2.text;
  return this.createAsync({
    subject1: {
      text: text1
    },
    subject2: {
      text: text2
    },
    subjectTexts: [text1, text2],
    createdBy: {
      name: data.user && data.user.name,
      userId: data.user && data.user.id
    }
  });
};
// TODO: will be depreciated
PollSchema.statics.findOneRandom = function (query, field, options) {
  var that = this,
  random = Math.random();

  query = query || {};
  query._random = { $gte: random };

  return that.findOneAsync(query, field, options).then(function (poll) {
    if (!poll) {
      query = _.clone(query); // this only needed to pass unit test using sinon
      query._random = { $lte: random };
      return that.findOneAsync(query, field, options);
    }
    return poll;
  });
};
// TODO: will be depreciated
PollSchema.statics.findOneRandomNew = function (query, field, options) {
  var that = this,
  random = Math.random();

  query = query || {};
  query._random = { $gte: random };

  options = options || {};
  options.sort = { _random: 1 };

  return that.findOneAsync(query, field, options).then(function (poll) {
    if (!poll) {
      query = _.clone(query); // this only needed to pass unit test using sinon
      delete query._random;
      return that.findOneAsync(query, field, options).then(function (poll) {
        if (!poll) {
          return null;
        }
        poll._random = Math.random();
        return poll.saveAsync().then(function (result) {
          return result[0];
        });
      });
    }
    poll._random = Math.random();
    return poll.saveAsync().then(function (result) {
      return result[0];
    });
  });
};

////////////////////////////////////////////////
// Instance Methods
PollSchema.methods.addVote = function (voterId, subjectId) {
  var that = this;
  if (!(subjectId === 1 || subjectId === 2)) {
    return Promise
      .reject(new Error('argument subjectId must be an integer 1 or 2'));
  }
  this.totalNumVotes += 1;
  this['subject' + subjectId].numVotes += 1;
  this.votes.push({
    voterId: voterId,
    subjectId: subjectId,
    subjectText: this['subject' + subjectId].text 
  });
  return this.saveAsync().then(function (result) {
    return result[0];
  });
};
//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

//TODO: need test
PollSchema.statics.getRecommendations = function (query, field) {
  var that = this,
      result = [],
      options = {},
      random = Math.random();

  query = query || {};
  query._random = { $gte: random };

  options.sort = { _random: 1 };
  options.limit = 10;

  return that.findAsync(query, field, options).then(function (poll) {
    var resultPromise;
    result = result.concat(poll);
    resultPromise = Promise.resolve(result);

    if (result.length < 10) {
      query._random = { $lt: random };
      options.limit = 10 - result.length;

      resultPromise = that.findAsync(query, field, options)
      .then(function (poll) {
        result = result.concat(poll);
        return result;
      });
    }
    return resultPromise;
  });
};

module.exports = mongoose.model('Poll', PollSchema);