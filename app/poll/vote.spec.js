'use strict';
/*jshint expr: true*/

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    User = require('app/user/user'),
    Poll = require('./poll'),
    eb = require('app/eventBus'),
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

var createUsers = function (numUsers) {
  var createUserPromises = []; 
  for (var i = 1; i <= numUsers; i += 1) {
    createUserPromises.push(User.createAsync({
      email: 'user' + i + '@test.com',
      name: 'user' + i, 
      picture: 'userPic' + i
    }));
  }
  return Promise.all(createUserPromises);
};

describe('Vote', function () {

  var user;

  beforeEach(function () {
    user = new User({
      name: 'Bob',
      picture: 'profilePic'
    });
    sinon.stub(eb, 'emit');
  });
  afterEach(function () {
    eb.emit.restore();
  });

  it('should create a vote', function () {
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      return Vote.createNew(user.id, poll.id, 1);
    });
    return expect(promise).to.eventually.be.fulfilled.then(function (vote) {
      expect(vote).to.have.property('_user');
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

  it('should get votes for user by provided pollIds', function () {
    var pollList, pollIds;
    var promise = Promise.all([
      Poll.publish(user, createPollData({ question: 'poll1' }) ), 
      Poll.publish(user, createPollData({ question: 'poll2' }) ), 
      Poll.publish(user, createPollData({ question: 'poll3' }) ), 
    ]).then(function (polls) {
      pollList = polls;
      pollIds = pollList.map(function (poll) {
        return poll.id;
      });
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(function () {
      return Vote.createNew(user.id, pollList[1].id, 2);
    }).then(function () {
      return Vote.createNew(user.id, pollList[2].id, 1);
    }).then(function () {
      return Vote.getByUserIdAndPollIds(user.id, pollIds);
    });

    return expect(promise).to.be.fulfilled.then(function (votes) {
      expect(votes).to.have.length(3);
      expect(votes[0]._poll.toString()).to.equal(pollIds[2].toString());
      expect(votes[1]._poll.toString()).to.equal(pollIds[1].toString()); 
      expect(votes[2]._poll.toString()).to.equal(pollIds[0].toString()); 
    });
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
    }).then(function () {
      return Vote.createNew(user.id, pollList[1].id, 2);
    }).then(function () {
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

  it('should exclude array values on #getByUserId', function () {
    var promise = Poll.publish(user, createPollData({question: 'poll1'}))
      .then(function (p) {
         return Vote.createNew(user.id, p.id, 1);
      }).then(function () {
        return Vote.getByUserId(user.id);
      });

    return expect(promise).to.be.fulfilled.then(function (votes) {
      expect(votes[0]._poll.answer1.voters).to.be.undefined;
      expect(votes[0]._poll.answer2.voters).to.be.undefined;
      expect(votes[0]._poll.comments).to.be.undefined;
      expect(votes[0]._poll.votes).to.be.undefined;
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
  
  it('should get voters for a pollId by answer', function () {
    var users = [], 
        pollId;
    // create a poll
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      // create users
      return createUsers(3);
    }).each(function (user, index) {
      var answer = (index === 1) ? 2 : 1;
      return Vote.createNew(user.id, pollId, answer);
    }).then(function () {
      return Vote.getVotersFor(pollId, 1); 
    });

    return expect(promise).to.be.fulfilled.then(function (voters) {
      expect(voters).to.have.length(2);

      // expect users are sorted ind revers order of the createion of the vote
      expect(voters[0]).to.have.property('name', 'user3');
      expect(voters[1]).to.have.property('name', 'user1');

      expect(voters[0]).to.not.have.property('followers');
    });
  });

  it('should get voters with pagination', function () {
    var users = [], 
        pollId;
    // create a poll
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      // create users
      return createUsers(4);
    }).each(function (user) {
      return Vote.createNew(user.id, pollId, 2);
    }).then(function (r) {
      return Vote.getVotersFor(pollId, 2, { skip: 1, limit: 2 }); 
    });

    return expect(promise).to.be.fulfilled.then(function (voters) {
      expect(voters).to.have.length(2);

      // expect users are sorted ind revers order of the createion of the vote
      expect(voters[0]).to.have.property('name', 'user3');
      expect(voters[1]).to.have.property('name', 'user2');

    });
  });

  it('should have #toJSON to get clean json', function () {
    var vote = new Vote({ answer: 1});
    expect(vote.toJSON()).to.have.property('id');
    expect(vote.toJSON()).to.not.have.property('_id');
    expect(vote.toJSON()).to.not.have.property('__V');
  });

});