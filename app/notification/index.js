'use strict';

var requireToken = require('app/middleware/requireToken'),
    Notification = require('app/notification/notificationModel'),
    Promise = require('bluebird'),
    express = require("express"),
    router = express.Router(),
    config = require('app/config'),
    User = require('app/user/user'),
    apn = require('apn'),
    eb = require('app/eventBus'),
    _ = require('lodash');

var populate = function (notification) {
  if (notification.verb === 'follow') {
    return notification.populateAsync({
      path: 'actor',
      select: 'name picture'
    });
  }
  return notification.populate({
    path: 'actor',
    select: 'name picture',
  }).populateAsync({
    path: 'object',
    model: 'Poll',
    select: 'question answer1.picture answer1.text answer2.picture answer2.text'
  });
};

var notify = function (notification) {
  sendPush(notification);
};

var sendPush = function (notification) {
//Note: To find all users with at least one device registered
//User.find({$and: [{deviceTokens: {$ne: []}}, {deviceTokens: {$ne: null}}]});

  var actor = notification.actor.name;
  var question = notification.object && notification.object.question;
  var msgs = {
    follow: actor + ' is now following you.',
    comment: actor + ' commented on the question: "' + question + '"', 
    create: actor + ' asked: "' + question + '"'
  };
  User.findByIdAsync(notification.user).then(function (user) {
    if (!user.deviceTokens) { return; }
    user.deviceTokens.forEach(function (token) {
      if (token.os === 'ios') {
        try {
          var device = new apn.Device(token.token);
          var note = new apn.Notification();
          note.badge = 0;
          note.contentAvailable = 1;
          note.sound = 'default';
          note.alert = {
            body : msgs[notification.verb],
            verb: notification.verb,
            objectType: notification.objectType,
            objectId: notification.verb === 'follow' ? notification.object: notification.object.id
          };
          note.device = device;

          var options = {
            cert: config.apns.cert,
            key:  config.apns.key
          };
          var apnsConnection = new apn.Connection(options);
          apnsConnection.sendNotification(note);
        } catch (e) {
          console.error(e);
        }
      }
    });
  });
};
// notification module 
var notification = module.exports = function () {

  var handleFollowNotification = function (data) {
    var userId = data.userId,
        targetUserId = data.toUserId,
        query = {
          user: targetUserId,
          actor: userId,
          verb: 'follow',
        },
        newNotification = _.assign(_.clone(query), {
          object: userId,
          objectType: 'user',
          updatedAt: Date.now()
        }),
        options = { new: true, upsert: true };

    Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(populate)
      .then(notify)
      .catch(console.error);
  };

  var handlePublishNotification = function (data) {
    var userId = data.user.id.toString(),
        poll = data.poll,
        followers = data.user.followers || [],
        i = 0;
    // create notification to all followers in non-blocing way
    (function next() {
      if (followers[i]) {
        var newNotification = {
          actor: userId,
          user: followers[i].userId,
          object: poll._id,
          objectType: 'poll',
          verb: 'create',
          updatedAt: Date.now()
        };

        Notification.createAsync(newNotification)
          .then(populate)
          .then(notify)
          .catch(console.error);

        i += 1;
        setImmediate(next);
      }
    }());
  };

  var handleVoteNotification = function (data) {
    var userId = data.userId.toString(),
        poll = data.poll,
        toUserId = poll.createdBy.userId.toString(),
        numVoted = poll.answer1.voters.length + poll.answer2.voters.length;
    // don't create notification if user is voting on his own poll   
    if (userId === toUserId) { return; }

    var query = {
          user: toUserId,
          object: poll._id,
          verb: 'vote',
        },
        newNotification = _.assign(_.clone(query), {
          actor: userId,
          objectType: 'poll',
          detail: {
            totalVote: numVoted,
            answer: data.answer
          },
          updatedAt: Date.now()
        }),
        options = { new: true, upsert: true };

    Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(populate)
      .then(notify)
      .catch(console.error);
  };

  var handleCommentNotification = function (data) {
    var userId = data.userId.toString(),
        poll = data.poll,
        subs = poll.subscribers;
    // TODO: optimize loop to async loop later
    subs.forEach(function (subscriberId) {

      // don't create notification if user is commenting on his own poll   
      if (userId === subscriberId.toString()) { return; }

      var newNotification = {
        actor: userId,
        user: subscriberId,
        object: poll._id,
        objectType: 'poll',
        verb: 'comment',
        updatedAt: Date.now()
      };
      Notification.createAsync(newNotification)
        .then(populate)
        .then(notify)
        .catch(console.error);
    });
  };

  var getNotifications = function (req, res, next) {
    var query = { user : req.user.id },
        options = { sort: { updatedAt: -1 }};
    options.limit = 100;

    Notification.findAsync(query, null, options).then(function (notes) {
      return Promise.all(notes.map(populate));
    }).then(res.status(202).json.bind(res))
      .catch(next);
  };

  var getNotificationCount = function (req, res, next) {
    var query = { user : req.user.id };

    if (req.query.after) {
      query.updatedAt = { $gt: req.query.after };
    }

    Notification.where(query)
      .countAsync(function (err, count) {
        res.status(200).send({ count: count });
      }).catch(next);
  };
 
  eb.on('userModel:follow', handleFollowNotification);
  eb.on('pollModel:publish', handlePublishNotification);
  eb.on('pollModel:vote', handleVoteNotification);
  eb.on('pollModel:comment', handleCommentNotification);

  router.get('/notifications', requireToken, getNotifications);
  router.get('/notifications/count', requireToken, getNotificationCount);

  return router; 
};