'use strict';

var requireToken = require('app/middleware/requireToken'),
    Notification = require('app/notification/notificationModel'),
    express = require("express"),
    eb = require('app/eventBus'),
    _ = require('lodash');


var notification = module.exports = function () {

  eb.on('userModel:follow', function (data) {
    setImmediate(function () {
      var userId = data.userId,
          targetUserId = data.toUserId,
          query = {
            user: targetUserId,
            actor: userId,
            verb: 'follow',
          },
          newNotification = _.assign(_.clone(query), {updatedAt: Date.now()}),
          options = { new: true, upsert: true };

      Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(function (notification) {
        return notification.populateAsync({
          path: 'user actor',
          select: 'name picture'
        });
      }).then(function (not) {
        console.log(not);
        console.log(not.actor.name+' is now following You, ' + not.user.name);
      }).catch(console.error);
    });
  });

  eb.on('pollModel:vote', function (data) {
    setImmediate(function () {
      var userId = data.userId.toString(),
          poll = data.poll,
          toUserId = poll.createdBy.userId.toString(),
          numVoted = poll.answer1.voters.length + poll.answer2.voters.length;


      // don't notify if user is voting to his own poll   
      if (userId === toUserId) { return; }

      // only notify first vote and when numVoted is multiple of 5
      if (numVoted !== 1 || (numVoted % 5 === 0)) { return; }

      var query = {
            user: toUserId,
            object: poll._id,
            verb: 'vote',
          },
          newNotification = _.assign(_.clone(query), {
            actor: userId,
            objectType: 'poll',
            updatedAt: Date.now()
          }),
          options = { new: true, upsert: true };

      Notification.findOneAndUpdateAsync(query, newNotification, options)
      .then(function (notification) {
        return notification.populateAsync({
          path: 'user actor',
          select: 'name picture',
        });
      }).then(function (not) {
        if (numVoted > 1) {
          console.log(not.actor.name, 'and', numVoted-1, 'others voted on:', poll.question);
        } else {
          console.log(not.actor.name, 'voted on:', poll.question);
        }
      }).catch(console.error);
    });
  });

  eb.on('pollModel:comment', function (data) {
    var userId = data.userId.toString(),
        poll = data.poll;
    //notify all involved users except userId

    console.log('comment event');
    console.log(data);
  });
  
  var router = express.Router();
  
  // router.get('/polls', requireToken, getRecentUnvotedPolls);

  return router; 
};