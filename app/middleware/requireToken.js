'use strict';

var Promise = require('bluebird'),
    User = require('app/user/user'),
    jwt = require('jwt-simple'),
    config = require('app/config');

var requiresToken = module.exports = function (req, res, next) {
  var token = (req.body && req.body.access_token) ||
              (req.query && req.query.access_token) ||
              req.headers['x-access-token'];
  var decoded;
  if (!token) {
    return res.status(401)
      .json({ status: 401, message: 'Access token is missing!' });
  }
  try {
    decoded = jwt.decode(token, config.jwtsecret);
  } catch (e) {
    return res.status(401)
      .json({ status: 401, message: 'Access token is not a valid token!'});
  }
  if (decoded.exp <= Date.now()) {
    return res.status(401)
      .json({ status: 401, message: 'Access token has been expired!' });
  }
  User.findByIdAsync(decoded.iss).then(function (user) {
    if (!user) {
      return res.status(401)
        .json({ status: 401, message: 'User not found with the token!' });
    }
    req.user = user;
    next();
  }).catch(next);
};