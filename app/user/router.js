'use strict';
var User = require('./user');
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

router.post('/api/v2/users', createUser);
router.get('/api/v2/users', listUsers);
router.get('/api/v2/users/:id', getUser);

module.exports = router;