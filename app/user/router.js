'use strict';
var jwt = require('jwt-simple'),
    User = require('./user'), 
    config = require('app/config'),
    router = require("express").Router(),
    Promise = require('bluebird'),
    request = Promise.promisify(require("request")),
    requiresToken = require('app/middleware/requiresToken');

var createUser = function (req, res, next) {
  User.createAsync(req.body).then(res.status(201).json.bind(res)).catch(next);
};

var listUsers = function (req, res, next) {
  User.findAsync({}).then(res.json.bind(res)).catch(next);
};

var getUser = function (req, res, next) {
  User.findByIdAsync(req.params.id).then(res.json.bind(res)).catch(next);
};

var signinWithPassword = function (req, res, next) {
  if (!req.body.email || !req.body.password) {
    return res.status(401)
              .json({ status: 401, message: 'Invalid credentials'});
  }
  User.findOneAsync({ email: req.body.email }).then(function (user) {
    if (!user) {
      res.status(401)
        .json({status: 401, message: 'Can\'t find a user with that email'});
    }
    var token = jwt.encode({
      iss: user.id,
      exp: Date.now() + config.jwtexp
    }, config.jwtsecret);
    return user.comparePassword(req.body.password).then(function (match) {
      if (!match) {
        return res.status(401)
                  .json({ status: 401, message: 'Password is not correct'});
      }
      res.json({
        user: user,
        access_token: token
      });
    });
  }).catch(next);
};

var signinWithFacebook = function (req, res, next) {
  if (!req.body.facebookAccessToken) {
    return res.status(400)
      .json({ status: 400, message: 'A facebook access token is required'});
  }
  request('https://graph.facebook.com/me?' +
    'field=id,email,name&access_token=' + 
    req.body.facebookAccessToken)
  .spread(function (response, body) {
    var profile;
    if (response.statusCode !== 200) {
      throw { 
        name: 'FacebookGraphAPIError',
        message: "Failed to fetch facebook user profile",
        status: 500
      };
    }
    return JSON.parse(body);
  }).then(function (fbProfile) {
    return User.findOneAsync({ 'facebook.id': fbProfile.id }).then(function (user) {
      if (!user) {
        var newUser = {
          email: fbProfile.email,
          name: fbProfile.name,
          facebook: { 
            id: fbProfile.id,
            email: fbProfile.email,
            name: fbProfile.name 
          }
        };
        return User.createAsync(newUser);
      }
      return user;
    });
  }).then(function (user) {
    var token = jwt.encode({
      iss: user.id,
      exp: Date.now() + config.jwtexp
    }, config.jwtsecret);
    res.json({ 
      user: user,
      access_token: token 
    }); 
  }).catch(function (e) {
    if (e.name === 'FacebookGraphAPIError') {
      return res.status(500).json(e);  
    }
    next(e); 
  });
};

var signin = function (req, res, next) {
  if (req.body.grantType === 'password') {
    signinWithPassword(req, res, next);
  } else if (req.body.grantType === 'facebook') {
    signinWithFacebook(req, res, next);
  } else {
    return res.status(400).json({
      status: 400,
      message: 'grantType field is missing or not valid'
    });
  }
};
 
router.post('/v2/users/signin', signin);

router.post('/v2/users', createUser);
router.get('/v2/users', requiresToken, listUsers);
router.get('/v2/users/:id', getUser);

module.exports = router;