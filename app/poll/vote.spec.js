'use strict';
/*jshint expr: true*/

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    User = require('app/user/user'),
    Poll = require('./poll'),
    _ = require('lodash');

var Vote = require('./vote');

var createPollData = function (overwrites) {
  var defaults = {
    question: 'which sports?',
    answer1: {
      text: 'basketball',
      picture: 'a1picurl'
    },
    answer2: {
      text: 'soccer',
      picture: 'a2picurl'
    } 
  };
  return _.extend(defaults, overwrites);
};

describe('Vote', function () {

  var user;

  beforeEach(function () {
    user = new User({
      name: 'Bob',
      picture: 'profilePic'
    });
  });

  it('should create a vote', function () {
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      return Vote.createNew(user.id, poll.id, 1);
    });
    return expect(promise).to.eventually.be.fulfilled.then(function (vote) {
      expect(vote).to.have.property('voterId');
      expect(vote).to.have.property('answer');
      expect(vote).to.have.property('_poll');
    });
  });

  it('should return null when creating to non-existing poll', function () {
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      return Vote.createNew(user.id, mongoose.Types.ObjectId(), 1);
    });
    return expect(promise).to.eventually.be.null;
  });

  it('should get votes for a user decending order by _id', function () {
    var pollList;
    var promise = Promise.all([
      Poll.publish(user, createPollData({ question: 'poll1' }) ), 
      Poll.publish(user, createPollData({ question: 'poll2' }) ), 
      Poll.publish(user, createPollData({ question: 'poll3' }) ), 
    ]).then(function (polls) {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(function (polls) {
      return Vote.createNew(user.id, pollList[1].id, 2);
    }).then(function (polls) {
      return Vote.createNew(user.id, pollList[2].id, 1);
    }).then(function () {
      return Vote.getByUserId(user.id);
    });

    return expect(promise).to.be.fulfilled.then(function (votes) {
      expect(votes).to.have.length(3);
      expect(votes[0]._poll.question).to.equal('poll3');
      expect(votes[1]._poll.question).to.equal('poll2'); 
      expect(votes[2]._poll.question).to.equal('poll1'); 
    });
  });

  it('should limit the number of result', function () {
    var pollList;
    var promise = Promise.all([
      Poll.publish(user, createPollData({ question: 'poll1' }) ), 
      Poll.publish(user, createPollData({ question: 'poll2' }) ), 
      Poll.publish(user, createPollData({ question: 'poll3' }) ), 
    ]).then(function (polls) {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(function () {
      return Vote.createNew(user.id, pollList[1].id, 2);
    }).then(function () {
      return Vote.createNew(user.id, pollList[2].id, 1);
    }).then(function () {
      return Vote.getByUserId(user.id, null, 1);
    });

    return expect(promise).to.eventually.have.length(1);
  });

  it('should get votes before provided vote id with limit', function () {
    var pollList, voteId;
    var promise = Promise.all([
      Poll.publish(user, createPollData({ question: 'poll1' }) ), 
      Poll.publish(user, createPollData({ question: 'poll2' }) ), 
      Poll.publish(user, createPollData({ question: 'poll3' }) ), 
      Poll.publish(user, createPollData({ question: 'poll4' }) ), 
    ]).then(function (polls) {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(function () {
      return Vote.createNew(user.id, pollList[1].id, 2);
    }).then(function () {
      return Vote.createNew(user.id, pollList[2].id, 1);
    }).then(function (vote) {
      voteId = vote.id;
      return Vote.createNew(user.id, pollList[3].id, 1);
    }).then(function () {
      return Vote.getByUserId(user.id, voteId, 1);
    });

    return expect(promise).to.be.fulfilled.then(function (votes) {
      expect(votes).to.have.length(1);
      expect(votes[0]._poll.question).to.equal('poll2');
    });
  });

});