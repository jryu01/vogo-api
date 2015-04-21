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
    text: { type: String, default: '' }
  }],

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
  var poll = {
    question: data.question,
    answer1: { 
      text: data.answer1 && data.answer1.text,
      picture: data.answer1 && data.answer1.picture
    },
    answer2: { 
      text: data.answer2 && data.answer2.text,
      picture: data.answer2 && data.answer2.picture
    },
    createdBy: {
      name: user.name,
      userId: user.id,
      picture: user.picture
    }
  };
  return this.createAsync(poll);
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

PollSchema.statics.voteAnswer = function (pollId, voterId, answerNumber) {
  var query = { 
    '_id': pollId,
    'answer1.voters': { $ne: voterId },
    'answer2.voters': { $ne: voterId }
  };
  var update = { $inc: {}, $addToSet: {} };

  if(answerNumber !== 1 && answerNumber !== 2) {
    return Promise.reject(
      new Error('Invalid answer: answer must be either number 1 or 2')
    );
  }

  update.$inc['answer' + answerNumber + '.numVotes'] = 1;
  update.$addToSet['answer'+ answerNumber + '.voters'] = voterId;

  return this.findOneAndUpdateAsync(query, update);
};

PollSchema.statics.comment = function (pollId, user, text) {
  var comment = {
    'createdBy': {
      userId: user.id,
      name: user.name,
      picture: user.picture
    },
    'text': text
  };
  var update = {
    '$push': {
      'comments': comment
    },
    '$inc': {
      'numComments': 1
    }
  };
  return this.findByIdAndUpdateAsync(pollId, update);
};

PollSchema.statics.getComments = function (pollId, options) {
  options = options || {};
  options.skip = options.skip || 0;
  options.limit = options.limit || 100;
  var project = { 
    'comments': { $slice: [options.skip, options.limit] }
  };
  return this.findByIdAsync(pollId, project).then(function (poll) {
    return poll ? poll.comments: [];
  });
};

//TODO: test this
PollSchema.statics.getRecentUnvoted = function (user, beforePollId, exclude) {
  var userId = mongoose.Types.ObjectId(user.id);
  var query = { 
    'answer1.voters': { $ne: userId }, 
    'answer2.voters': { $ne: userId }
  };
  if (exclude.length > 1) {
    exclude = exclude.map(function (id) {
      return mongoose.Types.ObjectId(id);
    });
    query._id = { $nin: exclude };
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
// var getRandom = function (req, res) {
//   var query = { 'votes.voterId': { $ne: req.user.id } },
//       exclude = req.query.exclude;

//   // exclude polls with provided ids
//   if (exclude && exclude !== 'undefined') {
//     // concat becaulse exlucde can be either single value or array
//     query._id = { $nin: [].concat(exclude) };
//   }
//   return Poll.findOneRandomNew(query);
// };
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

//^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
module.exports = mongoose.model('Poll', PollSchema);