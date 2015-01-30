'use strict';

// Private

var jwt = require('jwt-simple'),
    crypto = require('crypto'),
    config = require('../config'),
    User = require('./user/user'),
    Promise = require('bluebird'),
    request = Promise.promisify(require("request"));

var issueToken = function (uid) {
  var token = jwt.encode({
    iss: uid,
    exp: Date.now() + (60*24*60*60*1000) 
  }, config.jwtsecret);
  return token;
};

var getAwsInfo = function () {
  var expDate = new Date(Date.now() + (120*24*60*60*1000));
  var s3PolicyDoc = {
      "expiration": expDate.toISOString(),
      "conditions": [ 
        {"bucket": config.aws.bucket}, 
        ["starts-with", "$key", ""],
        {"acl": "public-read"},
        ["starts-with", "$Content-Type", ""],
        ["starts-with", "$filename", ""],
        ["content-length-range", 0, 1048576] //1 Mb
      ]
    };
  var s3Policy = new Buffer(JSON.stringify(s3PolicyDoc))
      .toString('base64');
  var hash = crypto.createHmac('sha1', config.aws.secretKey)
      .update(s3Policy)
      .digest();
  var s3Signiture = new Buffer(hash).toString('base64');

  var aws = {
    bucket: config.aws.bucket,
    s3Policy: s3Policy,
    s3Signiture: s3Signiture
  };
  return aws; 
};

var authenticateUser = function (email, password) {
  return User.findOneAsync({ email: email }).then(function (user) {
    if (!user) {
      throw { status: 401, message: 'Can\'t find a user with that email' };
    }
    return user.comparePassword( password ).then(function (match) {
      if (!match) {
        throw { status: 401, message: 'Password is not correct'};
      }
      return user;
    });
  });
};

var loadFacebookProfile = function (facebookToken) {
  return request('https://graph.facebook.com/me?' +
    'field=id,email,name&access_token=' + facebookToken)
  .spread(function (response, body) {
    if (response.statusCode !== 200) {
      throw { 
        name: 'FacebookGraphAPIError',
        message: "Failed to fetch facebook user profile",
        status: 500
      };
    }
    return JSON.parse(body);
  });
};

var getLoginInfo = function (user) {
  return {
    user: user,
    access_token: issueToken(user.id)
    // aws: getAwsInfo()
  };
};

var findOrCreateUserByFbProfile = function (profile) {
  return User
    .findOneAsync({'facebook.id': profile.id})
    .then(function (user) {

    if (!user) {
      var newUser = {
        email: profile.email,
        name: profile.name,
        facebook: { 
          id: profile.id,
          name: profile.name 
        }
      };
      return User.createAsync(newUser);
    } 
    return user; // if user already exists
  });
};

// Public

var security = module.exports = {

  verifyToken: function (req, res, next) {
    var token = (req.body && req.body.access_token) ||
                (req.query && req.query.access_token) ||
                req.headers['x-access-token'];
    return Promise.try(function () {
      if (!token) {
        throw { status: 401, message: 'Valid access token is required'};
      }
      return jwt.decode(token, config.jwtsecret);
    }).then(function (decoded) {
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
  },

  login: function (req, res) {
    if (req.body.grantType === 'password') {
      if (!req.body.email || !req.body.password) {
        return Promise.reject({ status: 401, message: 'Invalid credentials'});
      }  
      return authenticateUser(req.body.email, req.body.password)
              .then(getLoginInfo);
    } else if (req.body.grantType === 'facebook') {
      if (!req.body.facebookAccessToken) {
        return Promise.reject({ 
          status: 400, 
          message: 'A facebook access token is required' 
        });
      }
      return loadFacebookProfile(req.body.facebookAccessToken)
              .then(findOrCreateUserByFbProfile)
              .then(getLoginInfo);
    } else {
      return Promise.reject({
        status: 400, 
        message: 'grantType field is missing or not valid'
      });
    }
  }
};