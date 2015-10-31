import jwt from 'jsonwebtoken';
import User from './user';
import config from '../config';
import crypto from 'crypto';
import express from 'express';
import Promise from 'bluebird';
import requireToken from '../middleware/requireToken';
import errorhandler from 'api-error-handler';
import pUploader from './pUploader';

const request = Promise.promisifyAll(require('request'));

const createUser = function (req, res, next) {
  User.createAsync(req.body).then(res.status(201).json.bind(res)).catch(next);
};

const listUsers = function (req, res, next) {
  User.findAsync({}, '-followers').then(res.json.bind(res)).catch(next);
};

const getUser = function (req, res, next) {
  User.findByIdAsync(req.params.id, '-followers').then(res.json.bind(res)).catch(next);
};

const signinWithPassword = function (req, res, next) {
  if (!req.body.email || !req.body.password) {
    return next({ status: 401, message: 'Invalid credentials'});
  }
  User.findOneAsync({ email: req.body.email }, '-followers')
  .then(function (user) {
    if (!user) {
      throw {status: 401, message: 'Can\'t find a user with that email'};
    }
    return user.comparePassword(req.body.password).then(function (match) {
      if (!match) {
        throw { status: 401, message: 'Password is not correct'};
      }
      return user;
    });
  }).then(function (user) {
    const token = jwt.sign({
      uid: user.id,
      exp: Date.now() + config.jwtexp
    }, config.jwtsecret);
    res.json({
      user: user,
      access_token: token
    });
  }).catch(next);
};

const signinWithFacebook = function (req, res, next) {
  if (!req.body.facebookAccessToken) {
    return next({status: 400, message: 'A facebook access token is required'});
  }
  request.getAsync('https://graph.facebook.com/v2.3/me?' +
    'fields=id,email,name,picture.type(large)&access_token=' +
    req.body.facebookAccessToken)
  .spread(function (response, body) {
    if (response.statusCode !== 200) {
      throw {
        name: 'FacebookGraphAPIError',
        message: 'Failed to fetch facebook user profile',
        status: 500
      };
    }
    return JSON.parse(body);
  }).then(function (fbProfile) {
    return User.findOneAsync({ 'facebook.id': fbProfile.id }, '-followers')
    .then(function (user) {
      if (!user || !user._updated) {
        const usr = user || new User({
          email: fbProfile.email,
          name: fbProfile.name,
          facebook: {
            id: fbProfile.id,
            email: fbProfile.email,
            name: fbProfile.name
          }
        });
        const picture = fbProfile.picture && fbProfile.picture.data &&
            fbProfile.picture.data.url;
        return pUploader(picture, usr.id).then(function (uploadedUrl) {
          usr._updated = true;
          usr.picture = uploadedUrl;

          return User.createOrUpdate(usr.id, usr.toJSON());
        });
      }
      return user;
    });
  }).then(function (user) {
    const token = jwt.sign({
      uid: user.id,
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

const signin = function (req, res, next) {
  switch (req.body.grantType) {
  case 'password':
    signinWithPassword(req, res, next);
    break;
  case 'facebook':
    signinWithFacebook(req, res, next);
    break;
  default:
    next({ status: 400, message: 'grantType field is missing or not valid' });
  }
};

const follow = function (req, res, next) {
  const user = req.user;
  if (req.params.id !== user.uid.toString()) {
    return next({ status: 403 });
  }
  User.follow(user.uid, req.params.target).then(function () {
    return res.status(204).end();
  }).catch(next);
};

const unfollow = function (req, res, next) {
  const user = req.user;
  if (req.params.id !== user.uid.toString()) {
    return next({ status: 403 });
  }
  User.unfollow(user.uid, req.params.target).then(function () {
    res.status(204).end();
  }).catch(next);
};

const getFollowers = function (req, res, next) {
  const options = {};
  options.skip = parseInt(req.query.skip, 10) || 0;
  options.limit = parseInt(req.query.limit, 10) || 100;
  User.getFollowers(req.params.id, options)
    .then(res.json.bind(res))
    .catch(next);
};

const getFollowerCount = function (req, res, next) {
  User.getFollowerCount(req.params.id)
    .then(function (count) {
      res.json({ numberOfFollowers: count });
    }).catch(next);
};

const getFollowing = function (req, res, next) {
  const options = {};
  options.skip = parseInt(req.query.skip, 10) || 0;
  options.limit = parseInt(req.query.limit, 10) || 100;
  User.getFollowing(req.params.id, options)
    .then(res.json.bind(res))
    .catch(next);
};

const getFollowingCount = function (req, res, next) {
  User.getFollowingCount(req.params.id)
    .then(function (count) {
      res.json({ numberOfFollowing: count });
    }).catch(next);
};

const getFollowingInfo = function (req, res, next) {
  if (!req.query.userId) {
    return next({ status: 400, message: 'userId parameter is required'});
  }
  const uids = [].concat(req.query.userId);
  User.getFollowingInfo(req.user.uid, uids)
    .then(res.json.bind(res))
    .catch(next);
};

const getS3Info = function (req, res, next) {
  // TODO: Test
  const expDate = new Date(Date.now() + (120 * 24 * 60 * 60 * 1000));
  const s3PolicyDoc = {
    'expiration': expDate.toISOString(),
    'conditions': [
      {'bucket': config.aws.bucket},
      ['starts-with', '$key', ''],
      {'acl': 'public-read'},
      ['starts-with', '$Content-Type', ''],
      ['content-length-range', 0, 1048576] // 1 Mb
    ]
  };
  let s3Policy;
  let s3Signature;
  try {
    s3Policy = new Buffer(JSON.stringify(s3PolicyDoc))
      .toString('base64');
    const hash = crypto.createHmac('sha1', config.aws.secretKey)
        .update(s3Policy)
        .digest();
    s3Signature = new Buffer(hash).toString('base64');
  } catch (err) {
    return next(err);
  }

  const info = {
    bucket: config.aws.bucket,
    uploadUrl: 'https://s3.amazonaws.com/' + config.aws.bucket + '/',
    accessKey: config.aws.accessKey,
    policy: s3Policy,
    signature: s3Signature
  };
  res.json(info);
};

const registerDeviceToken = function (req, res, next) {
  User.registerDeviceToken(req.user.uid, req.body.token, req.body.os || 'ios')
    .then(res.status(201).json.bind(res)).catch(next);
};

export default () => {
  const router = express.Router();

  router.post('/login', signin);
  router.post('/users', createUser);

  // Below routes require authentication tokens
  router.use(requireToken);

  router.get('/s3info', getS3Info); // TODO: need test
  router.post('/deviceTokens', registerDeviceToken);

  router.get('/users', listUsers); // will be depreciated
  router.get('/users/:id', getUser);

  router.put('/users/:id/following/:target', follow);
  router.delete('/users/:id/following/:target', unfollow);
  router.get('/users/:id/followers', getFollowers);
  router.get('/users/:id/followers-count', getFollowerCount);
  router.get('/users/:id/following', getFollowing);
  router.get('/users/:id/following-count', getFollowingCount);

  router.get('/relationships/following', getFollowingInfo);

  router.use(errorhandler());

  return router;
};
