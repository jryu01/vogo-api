'use strict';

var _ = require('lodash'),
    Poll = require('./poll'),
    mongoose = require('mongoose'),
    pollController = {};

pollController.list = function (req, res, next) {
  var query = {}, 
      options = {
        sort: { updatedAt: -1 },
        limit: 10
      },
      projection = {
        'createdBy': 1,
        'createdAt': 1,
        'updatedAt': 1,
        'subject1': 1,
        'subject2': 1,
        'subjectTexts': 1,
        'totalNumVotes': 1,
        'tags': 1
      };

  if (req.query.before) {
    query.updatedAt = { $lt: req.query.before };
  }

  if (req.query.voterId) {
    query['votes.voterId'] = mongoose.Types.ObjectId(req.query.voterId);
    // projection['votes.$'] = 1;
    if (req.query.votedBefore) {
      query['votes.createdAt'] = { $lt: new Date(req.query.votedBefore) };
    }
    return Poll.aggregateAsync([
      { $match: { "votes.voterId": query['votes.voterId'] } },
      { $unwind: "$votes" },
      { $match:  query },
      { $sort: { "votes.createdAt": -1} },
      { $limit: 20 } 
    ]).then(function (polls) {
      polls.forEach(function (poll) {
        poll.votes = [poll.votes];
      });
      return polls;
    });
  }
  return Poll.findAsync(query, projection, options);
};

pollController.listMyPoll = function (req, res) {
  var user = req.user;
  var query = { 'createdBy.userId': user.id };

  if (req.query.before) {
    query.updatedAt = { $lt: req.query.before };
  }
  var options = {
    sort: { updatedAt: -1 },
    limit: 20
  };
  return Poll.findAsync(query, null, options);
};

pollController.create = function (req, res) {
  _.extend(req.body, { user: req.user });
  return Poll.createNew(req.body);
};

pollController.getRandom = function (req, res) {
  return Poll.findOneRandom({'votes.voterId': { $ne: req.user.id }});
};

pollController.createVote = function (req, res) {
  var subjectId = req.body.subjectId,
      voterId = req.user.id,
      query = {
        _id: req.params.id,
        'votes.voterId': { $ne: voterId }
      };
  return Poll.findOneAsync(query).then(function (poll) {
    if (!poll) {
      throw { status: 400, message: 'Could not create new vote'};
    }
    return poll.addVote(voterId, subjectId);
  });
};

module.exports = pollController;