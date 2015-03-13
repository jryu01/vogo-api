'use strict';

var User = require('./user');

var userController = module.exports = {
  list: function (req, res, next) {
    return User.findAsync({});
  },

  get : function (req, res, next) {
    return User.findByIdAsync(req.params.id);
  },

  post: function (req, res, next) {
    return User.createAsync(req.body);
  }
};

