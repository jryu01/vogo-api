'use strict';

var express = require('express');
var router = express.Router();

var userCtrl = require('app/user/userController');
var pollCtrl = require('app/poll/pollController');
var security = require('app/security');

// exports router
module.exports = router;

// wraps given function which returns promise to build middleware function 
// that calls res.json
function res(promiseReturningFunction) {
  return function (req, res, next) {
    promiseReturningFunction(req, res, next).then(function (result) {
      res.json(result);
    }).catch(next);
  };
}
// wraps function which returns promise to build middleware function 
// that calls next
function next(promiseReturningFunction) {
  return function (req, res, next) {
    promiseReturningFunction(req, res, next).then(function () {
      next();
    }).catch(next);
  };
}

router.post('/login', res(security.login));
router.post('/api/login', res(security.login));

router.post('/api/users', res(userCtrl.post));
router.get('/api/users', next(security.verifyToken), res(userCtrl.list));
router.get('/api/users/:id', res(userCtrl.get));

router.all('/api/me*', next(security.verifyToken));
router.get('/api/me/polls', res(pollCtrl.listMyPoll));

router.all('/api/polls*', next(security.verifyToken));
router.post('/api/polls', res(pollCtrl.create)); 
router.get('/api/polls', res(pollCtrl.list));
router.get('/api/polls/random', res(pollCtrl.getRandom)); 
router.post('/api/polls/:id/votes', res(pollCtrl.createVote));