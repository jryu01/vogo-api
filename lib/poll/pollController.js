'use strict';

var _ = require('lodash'),
    Poll = require('./poll'),
    pollController = {};

// pollController.list = function (req, res, next) {
//   var query = {}, 
//       options = {};

//   // if (req.query.lastItemStartTime) {
//   //   query.startTime = { $gte: req.query.lastItemStartTime };
//   //   if (req.query.lastItemUpdatedTime) {
//   //     query = {
//   //       $or: [{ 
//   //         startTime: req.query.lastItemStartTime,
//   //         updatedTime: { $lt: req.query.lastItemUpdatedTime }
//   //       },
//   //       {
//   //         startTime: { $gt: req.query.lastItemStartTime }
//   //       }] 
//   //     };
//   //   }
//   // }

//   // options = { 
//   //   sort: { startTime: 1, updatedTime: -1 },
//   //   limit: 10
//   // };

//   return Poll.findAsync(query, null, options);
// };

pollController.create = function (req, res) {
  _.extend(req.body, { user: req.user });
  return Poll.createNew(req.body);
};
pollController.getRandom = function (req, res) {
  return Poll.findOneRandom({});
};
pollController.createVote = function (req, res) {
  var subjectId = req.body.subjectId,
      voterId = req.user.id,
      query = {
        _id: req.params.id,
        'votes.voterId': { $ne: voterId }
      };
  return Poll.findOneAsync(query).then(function (poll) {
    if (!poll) {
      throw { status: 400, message: 'Could not create new vote'};
    }
    return poll.addVote(voterId, subjectId);
  });
};

module.exports = pollController;