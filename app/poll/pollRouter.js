'use strict';

var requireToken = require('app/middleware/requireToken'),
    mongoose = require('mongoose'),
    express = require("express"),
    Poll = require('./poll'),
    Vote = require('./vote'),
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

var create = function (req, res, next) {
  _.extend(req.body, { user: req.user });
  Poll.createNew(req.body).then(res.status(201).json.bind(res)).catch(next);
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
    // concat because exlucde can be either single value or array
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
//////////////////////////////////////////////////////////////////
var publish = function (req, res, next) {
  //TODO: input validation with req.body
  Poll.publish(req.user, req.body)
    .then(res.status(201).json.bind(res))
    .catch(next);
};

var vote = function (req, res, next) {
  //TODO: input validation
  Vote.createNew(req.user.id, req.params.id, req.body.answer)
    .then(function (poll) {
      if (!poll) {
        throw { 
          status: 404, 
          message: 'poll not found or already voted with the user' 
        };
      }
      res.status(201).json(poll);
    }).catch(next);
};

var comment = function (req, res, next) {
  //TODO: input validation
  var pollId = req.params.id;
  Poll.comment(pollId, req.user, req.body.text).then(function (poll) {
    if (!poll) {
       throw { status: 404, message: 'poll not found'};
    }
    var newComment = poll.comments[poll.comments.length - 1];
    res.status(201).json(newComment);
  }).catch(next);
};

var getComments = function (req, res, next) {
  var pollId = req.params.id;
  var options = {};  
  options.skip = parseInt(req.query.skip, 10) || 0;
  options.limit = parseInt(req.query.limit, 10) || 20; 
  Poll.getComments(pollId, options).then(res.json.bind(res)).catch(next);
};

var getPollById = function (req, res, next) {
  Poll.getById(req.params.id).then(res.json.bind(res)).catch(next);
};

var getUserPolls = function (req, res, next) {
  var userId = req.params.id,
      beforePollId = req.query.before || null,
      limit = 20;
  Poll.getByUserId(userId, beforePollId, limit)
    .then(res.json.bind(res))
    .catch(next);
};

var getUserVotes = function (req, res, next) {
  var userId = req.params.id,
      beforeVoteId = req.query.before || null,
      limit = 20;
  Vote.getByUserId(userId, beforeVoteId, limit)
    .then(res.json.bind(res))
    .catch(next);
};

var pollRouter = module.exports = function () {
  
  var router = express.Router();
  
  // router.all('/me*', requireToken);
  // router.get('/me/polls', res(listMyPoll));
  
  // router.all('/polls*', requireToken);
  // router.post('/polls', create); 
  // router.get('/polls', res(list));
  // router.get('/polls/random', res(getRandom)); 
  // router.post('/polls/:id/votes', res(createVote));


/////////////////////////////////////////////
  router.post('/polls', requireToken, publish);
  router.post('/polls/:id/votes', requireToken, vote);
  router.post('/polls/:id/comments', requireToken, comment);

  router.get('/polls/:id', requireToken, getPollById);
  router.get('/polls/:id/comments', requireToken, getComments);

  router.get('/users/:id/polls', requireToken, getUserPolls);
  router.get('/users/:id/votes', requireToken, getUserVotes);

  router.get('/polls/recommendation');

  return router; 
};