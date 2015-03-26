'use strict';

var requireToken = require('app/middleware/requireToken'),
    mongoose = require('mongoose'),
    express = require("express"),
    Poll = require('./poll'),
    _ = require('lodash');

var list = function (req, res, next) {

  if (req.query.random === "true" ) {
    return getRecommendations(req, res, next);
  }

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
      { $limit: 10 } 
    ]).then(function (polls) {
      polls.forEach(function (poll) {
        poll.votes = [poll.votes];
      });
      return polls;
    });
  }
  return Poll.findAsync(query, projection, options);
};

var listMyPoll = function (req, res) {
  var user = req.user;
  var query = { 'createdBy.userId': user.id };

  if (req.query.before) {
    query.updatedAt = { $lt: req.query.before };
  }
  var options = {
    sort: { updatedAt: -1 },
    limit: 10
  };
  return Poll.findAsync(query, null, options);
};

var create = function (req, res) {
  _.extend(req.body, { user: req.user });
  return Poll.createNew(req.body);
};

var getRandom = function (req, res) {
  var query = { 'votes.voterId': { $ne: req.user.id } },
      exclude = req.query.exclude;

  // exclude polls with provided ids
  if (exclude && exclude !== 'undefined') {
    // concat becaulse exlucde can be either single value or array
    query._id = { $nin: [].concat(exclude) };
  }
  return Poll.findOneRandomNew(query);
};

var getRecommendations = function (req, res) {
  var query = { 'votes.voterId': { $ne: req.user.id } },
      exclude = req.query.exclude;

  // exclude polls with provided ids
  if (exclude && exclude !== 'undefined') {
    // concat becaulse exlucde can be either single value or array
    query._id = { $nin: [].concat(exclude) };
  }
  return Poll.getRecommendations(query);
};

var createVote = function (req, res) {
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

function res(promiseReturningFunction) {
  return function (req, res, next) {
    promiseReturningFunction(req, res, next).then(function (result) {
      res.json(result);
    }).catch(next);
  };
}

var pollRouter = module.exports = function () {
  
  var router = express.Router();
  
  router.all('/api/me*', requireToken);
  router.get('/api/me/polls', res(listMyPoll));
  
  router.all('/api/polls*', requireToken);
  router.post('/api/polls', res(create)); 
  router.get('/api/polls', res(list));
  router.get('/api/polls/random', res(getRandom)); 
  router.post('/api/polls/:id/votes', res(createVote));
  
  return router; 
}