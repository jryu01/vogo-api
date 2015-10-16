const requireToken = require('app/middleware/requireToken');
const Notification = require('app/notification/notificationModel');
const Promise = require('bluebird');
const express = require('express');
const router = express.Router();
const config = require('app/config');
const User = require('app/user/user');
const apn = require('apn');
const gcm = require('node-gcm');
const eb = require('app/eventBus');
const _ = require('lodash');

const populate = function (notification) {
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

const sendPush = function (notification) {
// Note: To find all users with at least one device registered
// User.find({$and: [{deviceTokens: {$ne: []}}, {deviceTokens: {$ne: null}}]});
  const actor = notification.actor.name;
  const question = notification.object && notification.object.question;
  const msgs = {
    follow: actor + ' is now following you.',
    comment: actor + ' commented on the question: "' + question + '"',
    create: actor + ' asked: "' + question + '"'
  };
  const payload = {
    title: 'Vogo',
    body: msgs[notification.verb],
    verb: notification.verb,
    objectType: notification.objectType,
    objectId: notification.verb === 'follow' ? notification.object : notification.object.id
  };
  User.findByIdAsync(notification.user).then(function (user) {
    const androidDevices = [];

    if (!user.deviceTokens) { return; }

    user.deviceTokens.forEach(function (token) {
      if (token.os === 'ios') {
        try {
          const device = new apn.Device(token.token);
          const note = new apn.Notification();
          note.badge = 0;
          note.contentAvailable = 1;
          note.sound = payload.verb === 'vote' ? '' : 'default';
          note.alert = payload;
          note.device = device;

          const options = {
            cert: config.apns.cert,
            key: config.apns.key
          };
          const apnsConnection = new apn.Connection(options);
          apnsConnection.sendNotification(note);
        } catch (e) {
          console.error(e);
        }
      } else if (token.os === 'android') {
        androidDevices.push(token.token);
      }
    });

    if (androidDevices.length < 1) { return; }

    // send push to android devices

    const message = new gcm.Message();

    message.addData(_.assign(payload, {
      message: payload.body
    }));

    // Set up the sender with you API key
    const sender = new gcm.Sender(config.google.apiKey);
    // Now the sender can be used to send messages
    sender.send(message, androidDevices, 4, function (err) {
      if (err) { console.error(err); }
    });
  }).catch(console.error);
};

// notification module
module.exports = function () {
  const handleFollowNotification = function (data) {
    const userId = data.userId;
    const targetUserId = data.toUserId;
    const query = {
      user: targetUserId,
      actor: userId,
      verb: 'follow',
    };
    const newNotification = _.assign(_.clone(query), {
      object: userId,
      objectType: 'user',
      updatedAt: Date.now()
    });
    const options = { new: true, upsert: true };

    Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(populate)
      .then(sendPush)
      .catch(console.error);
  };

  const handlePublishNotification = function (data) {
    const userId = data.user.id.toString();
    const poll = data.poll;
    const followers = data.user.followers || [];
    let i = 0;
    // create notification to all followers in non-blocing way
    (function next() {
      if (followers[i]) {
        const newNotification = {
          actor: userId,
          user: followers[i].userId,
          object: poll._id,
          objectType: 'poll',
          verb: 'create',
          updatedAt: Date.now()
        };

        Notification.createAsync(newNotification)
          .then(populate)
          .then(sendPush)
          .catch(console.error);

        i += 1;
        setImmediate(next);
      }
    }());
  };

  const handleVoteNotification = function (data) {
    const userId = data.userId.toString();
    const poll = data.poll;
    const toUserId = poll.createdBy.userId.toString();
    const numVoted = poll.answer1.voters.length + poll.answer2.voters.length;
    // don't create notification if user is voting on his own poll
    if (userId === toUserId) { return; }

    const query = {
      user: toUserId,
      object: poll._id,
      verb: 'vote',
    };
    const newNotification = _.assign(_.clone(query), {
      actor: userId,
      objectType: 'poll',
      detail: {
        totalVote: numVoted,
        answer: data.answer
      },
      updatedAt: Date.now()
    });
    const options = { new: true, upsert: true };
    Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(populate)
      .then(sendPush)
      .catch(console.error);
  };

  const handleCommentNotification = function (data) {
    const userId = data.userId.toString();
    const poll = data.poll;
    const subs = poll.subscribers;
    // TODO: optimize loop to async loop later
    subs.forEach(function (subscriberId) {
      // don't create notification if user is commenting on his own poll
      if (userId === subscriberId.toString()) { return; }

      const newNotification = {
        actor: userId,
        user: subscriberId,
        object: poll._id,
        objectType: 'poll',
        verb: 'comment',
        updatedAt: Date.now()
      };
      Notification.createAsync(newNotification)
        .then(populate)
        .then(sendPush)
        .catch(console.error);
    });
  };

  const getNotifications = function (req, res, next) {
    const query = { user: req.user.id };
    const options = { sort: { updatedAt: -1 }};
    options.limit = 100;

    Notification.findAsync(query, null, options).then(function (notes) {
      return Promise.all(notes.map(populate));
    }).then(res.status(202).json.bind(res))
      .catch(next);
  };

  const getNotificationCount = function (req, res, next) {
    const query = { user: req.user.id };

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
