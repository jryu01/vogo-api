'use strict';

var requireToken = require('app/middleware/requireToken'),
    mongoose = require('mongoose'),
    express = require("express"),
    Poll = require('./poll'),
    Vote = require('./vote'),
    _ = require('lodash');

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

//TODO: test
var getRecentUnvotedPolls = function (req, res, next) {
  var user = req.user,
      exclude = req.query.exclude || [],
      beforePollId = req.query.before;
  return Poll.getRecentUnvoted(user, beforePollId, [].concat(exclude))
    .then(res.json.bind(res))
    .catch(next);
};

var pollRouter = module.exports = function () {
  
  var router = express.Router();
  
  router.post('/polls', requireToken, publish);
  router.post('/polls/:id/votes', requireToken, vote);
  router.post('/polls/:id/comments', requireToken, comment);

  router.get('/polls/:id', requireToken, getPollById);
  router.get('/polls/:id/comments', requireToken, getComments);

  router.get('/users/:id/polls', requireToken, getUserPolls);
  router.get('/users/:id/votes', requireToken, getUserVotes);

  //Need Test
  router.get('/polls', requireToken, getRecentUnvotedPolls);

  return router; 
};