'use strict';
var jwt = require('jwt-simple'),
    User = require('./user'), 
    config = require('app/config'),
    crypto = require('crypto'),
    express = require("express"),
    Promise = require('bluebird'),
    request = Promise.promisify(require("request")),
    requireToken = require('app/middleware/requireToken');

var createUser = function (req, res, next) {
  User.createAsync(req.body).then(res.status(201).json.bind(res)).catch(next);
};

var listUsers = function (req, res, next) {
  User.findAsync({}, '-followers').then(res.json.bind(res)).catch(next);
};

var getUser = function (req, res, next) {
  User.findByIdAsync(req.params.id, '-followers').then(res.json.bind(res)).catch(next);
};
// var test = function (username, password, done) {
//   User.findOneAsync({ email: username }).then(function (user) {
//     if (!user) {
//         return done({status: 401, message: 'Can\'t find a user with that email'});
//     }
//     return user.comparePassword(password).then(function (match) {
//       if (!match) {
//         return done({ status: 401, message: 'Password is not correct'});
//       }
//       return done(null, user);
//     });
//   }).catch(done);
// };
var signinWithPassword = function (req, res, next) {
  if (!req.body.email || !req.body.password) {
    return res.status(401)
              .json({ status: 401, message: 'Invalid credentials'});
  }
  User.findOneAsync({ email: req.body.email }, '-followers')
  .then(function (user) {
    if (!user) {
      res.status(401)
        .json({status: 401, message: 'Can\'t find a user with that email'});
    }
    return user.comparePassword(req.body.password).then(function (match) {
      if (!match) {
        return res.status(401)
                  .json({ status: 401, message: 'Password is not correct'});
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
  }).catch(next);
};

var signinWithFacebook = function (req, res, next) {
  if (!req.body.facebookAccessToken) {
    return res.status(400)
      .json({ status: 400, message: 'A facebook access token is required'});
  }
  request('https://graph.facebook.com/v2.3/me?' +
    'fields=id,email,name,picture&access_token=' + 
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
    return User.findOneAsync({ 'facebook.id': fbProfile.id }, '-followers')
    .then(function (user) {
      if (!user) {
        var picture = fbProfile.picture && fbProfile.picture.data && 
            fbProfile.picture.data.url;
        var newUser = {
          email: fbProfile.email,
          name: fbProfile.name,
          picture: picture,
          facebook: { 
            id: fbProfile.id,
            email: fbProfile.email,
            name: fbProfile.name,
            picture: picture
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

var follow = function (req, res, next) {
  var user = req.user,
      update;
  if (req.params.id !== user.id.toString()) {
    return res.status(403).json({
      status: 403,
      message: 'Not authorized!'
    });
  }
  User.follow(user, req.params.target).then(function () {
    return res.status(204).end();
  });
};

var unfollow = function (req, res, next) {
  var user = req.user,
      update;
  if (req.params.id !== user.id.toString()) {
    return res.status(403).json({
      status: 403,
      message: 'Not authorized!'
    });
  }
  User.unfollow(user, req.params.target).then(function (r) {
    return res.status(204).end();
  });
};

var getFollowers = function (req, res, next) {
  var options = {};
  options.skip = parseInt(req.query.skip, 10) || 0; 
  options.limit = parseInt(req.query.limit, 10) || 100; 
  User.getFollowers(req.params.id, options)
    .then(res.json.bind(res))
    .catch(next);
};

var getFollowerCount = function (req, res, next) {
   User.getFollowerCount(req.params.id)
    .then(function (count) {
      res.json({ numberOfFollowers: count });
    }).catch(next);
};

var getFollowing = function (req, res, next) {
  var options = {};
  options.skip = parseInt(req.query.skip, 10) || 0; 
  options.limit = parseInt(req.query.limit, 10) || 100; 
  User.getFollowing(req.params.id, options)
    .then(res.json.bind(res))
    .catch(next);
};

var getFollowingCount = function (req, res, next) {
  User.getFollowingCount(req.params.id)
    .then(function (count) {
      res.json({ numberOfFollowing: count });
    }).catch(next);
};

var getFollowingInfo = function (req, res, next) {
  if (!req.query.userId) {
     return res.status(400)
      .json({ status: 400, message: 'userId parameter is required'});
  }
  var uids = [].concat(req.query.userId);
  User.getFollowingInfo(req.user.id, uids)
    .then(res.json.bind(res))
    .catch(next);
};

var getS3Info = function (req, res, next) {
  //TODO: Test
  var expDate = new Date(Date.now() + (120*24*60*60*1000));
  var s3PolicyDoc = {
    "expiration": expDate.toISOString(),
    "conditions": [ 
      {"bucket": config.aws.bucket}, 
      ["starts-with", "$key", ""],
      {"acl": "public-read"},
      ["starts-with", "$Content-Type", ""],
      ["content-length-range", 0, 1048576] //1 Mb
    ]
  };
  var s3Policy, hash, s3Signature;
  try {
    s3Policy = new Buffer(JSON.stringify(s3PolicyDoc))
        .toString('base64');
    hash = crypto.createHmac('sha1', config.aws.secretKey)
        .update(s3Policy)
        .digest();
    s3Signature = new Buffer(hash).toString('base64');
  } catch (err) {
    next(err);
  }

  var info = {
    bucket: config.aws.bucket,
    uploadUrl: 'https://s3.amazonaws.com/' + config.aws.bucket + '/',
    accessKey: config.aws.accessKey,
    policy: s3Policy,
    signature: s3Signature
  };
  res.json(info);
};

var userRouter = module.exports = function () {
  
  var router = express.Router();
  router.post('/login', signin);
  // router.post('/api/login', signin);
  // router.post('/users/signin', signin);

  router.get('/s3info', requireToken, getS3Info); //TODO: need test
  
  router.post('/users', createUser);
  router.get('/users', requireToken, listUsers); // will be depreciated
  router.get('/users/:id', requireToken, getUser);

  router.put('/users/:id/following/:target', requireToken, follow);
  router.delete('/users/:id/following/:target', requireToken, unfollow);
  router.get('/users/:id/followers', requireToken, getFollowers);
  router.get('/users/:id/followers-count', requireToken, getFollowerCount);
  router.get('/users/:id/following', requireToken, getFollowing);
  router.get('/users/:id/following-count', requireToken, getFollowingCount);

  router.get('/relationships/following', requireToken, getFollowingInfo);
  return router;
};