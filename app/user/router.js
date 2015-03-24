'use strict';
var User = require('./user');
var requiresToken = require('app/middleware/requiresToken');
var config = require('app/config');
var jwt = require('jwt-simple');
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

var signin = function (req, res, next) {
  if (req.body.grantType === 'password') {
    if (!req.body.email || !req.body.password) {
      return res.status(401)
                .json({ status: 401, message: 'Invalid credentials'});
    }
    User.findOneAsync({ email: req.body.email }).then(function (user) {
      if (!user) {
        res.status(401)
          .json({status: 401, message: 'Can\'t find a user with that email'});
      }
      var ACCESS_TOKEN = jwt.encode({
        iss: user.id,
        exp: Date.now() + config.jwtexp
      }, config.jwtsecret);
      return user.comparePassword(req.body.password).then(function (match) {
        if (!match) {
          return res.status(401)
                    .json({ status: 401, message: 'Password is not correct'});
        }
        res.status(200).json({
          user: user,
          access_token: ACCESS_TOKEN
        });
      });
    }).catch(next);
  } else {
    return res.status(400).json({
      status: 400,
      message: 'grantType field is missing or not valid'
    });
  }
};
 

// return User.findOneAsync({ email: email }).then(function (user) {
//     if (!user) {
//       throw { status: 401, message: 'Can\'t find a user with that email' };
//     }
//     return user.comparePassword( password ).then(function (match) {
//       if (!match) {
//         throw { status: 401, message: 'Password is not correct'};
//       }
//       return user;
//     });
//   });
  
router.post('/v2/users/signin', signin);

router.post('/v2/users', createUser);
router.get('/v2/users', requiresToken, listUsers);
router.get('/v2/users/:id', getUser);

module.exports = router;