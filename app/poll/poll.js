'use strict';

var _ = require('lodash'),
    Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require("mongoose")),
    Schema = mongoose.Schema;
 
var PollSchema = new Schema({

  createdBy: {
    name: { type: String, required: '{PATH} is required!' },
    userId: { type: Schema.Types.ObjectId, required: '{PATH} is required!' }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  subject1: {
    text: { type: String, required: '{PATH} is required!' },
    numVotes: { type: Number, default: 0 }
  },
  subject2: {
    text: { type: String, required: '{PATH} is required!' },
    numVotes: { type: Number, default: 0 }
  },
  subjectTexts: [],

  totalNumVotes: { type: Number, default: 0 }, 

  votes: [{
    voterId: { type: Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now },
    subjectId: { type: Number },
    subjectText: { type: String }
  }],

  tags: [String],

  _random: { type: Number, default: Math.random }
});

// Indeices
PollSchema.index({'votes.voterId': 1, '_random': 1});
PollSchema.index({'votes.voterId': 1, '_id': -1, '_random': 1});
PollSchema.index({'votes.voterId': 1, 'votes.createdAt': -1 });
PollSchema.index({'createdBy.userId': 1, 'updatedAt': -1 });

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


module.exports = mongoose.model('Poll', PollSchema);