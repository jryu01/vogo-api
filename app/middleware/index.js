'use strict';

var Promise = require('bluebird'),
    User = require('app/user/user'),
    jwt = require('jwt-simple'),
  // crypto = require('crypto'),
    config = require('app/config');
  // User = require('./user/user'),
  // Promise = require('bluebird'),
  // request = Promise.promisify(require("request"));


var requiresAccessToken = function (req, res, next) {
  var token = (req.body && req.body.access_token) ||
              (req.query && req.query.access_token) ||
              req.headers['x-access-token'];
  var decoded;
  // if (!token) {
  //   return res.status(401)
  //     .json({ status: 401, message: 'Access token is missing!' });
  // }
  decoded = jwt.decode(token, config.jwtsecret);

  User.findByIdAsync(decoded.iss).then(function (user) {
    if (!user) {
      return res.status(401)
        .json({ status: 401, message: 'User not found with the token' });
    }
    req.user = user;
    next();
  });
};
var verifyToken = function (req, res, next) {
    // var token = (req.body && req.body.access_token) ||
    //             (req.query && req.query.access_token) ||
    //             req.headers['x-access-token'];
    // var decoded;
    // if (!token) {
    //   return Promise
    //     .reject({ status: 401, message: 'Access token is missing!'});
    // }
    try {
      decoded = jwt.decode(token, config.jwtsecret);
    } catch (e) {
      return Promise
        .reject({ status: 401, message: 'Access token is not a valid token!'});
    }
    return Promise.resolve(decoded).then(function (decoded) {
      if (decoded.exp <= Date.now()) {
        throw { status: 401, message: 'Access token has been expired' };
      }
      return User.findByIdAsync(decoded.iss);
    }).then(function (user) {
      if (!user) {
        throw { status: 401, message: 'User not found with the token' };
      }
      req.user = user;
      return user;
    });
  };

module.exports = {
  requiresAccessToken: requiresAccessToken
};