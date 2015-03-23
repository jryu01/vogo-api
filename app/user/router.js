'use strict';
var User = require('./user');
var requiresToken = require('app/middleware/requiresToken');
var router = require("express").Router();

var createUser = function (req, res, next) {
  User.createAsync(req.body).then(res.status(201).json.bind(res)).catch(next);
};

var listUsers = function (req, res, next) {
  User.findAsync({}).then(res.json.bind(res)).catch(next);
};

var getUser = function (req, res, next) {
  User.findByIdAsync(req.params.id).then(res.json.bind(res)).catch(next);
};

router.post('/v2/users', createUser);
router.get('/v2/users', requiresToken, listUsers);
router.get('/v2/users/:id', getUser);

module.exports = router;