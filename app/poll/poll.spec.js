'use strict';
/*jshint expr: true*/

var mongoose = require('mongoose'),
    Promise = require('bluebird'),
    User = require('app/user/user'),
    _ = require('lodash');

var Poll = require('./poll');

var dataFactory = {
  create: function (overwrites) {
    var defaults = {
      subject1: { text: 'Basketball' },
      subject2: { text: 'Soccer' },
      user: { 
        id: '544ef523ef51cd394ba17326', 
        name: 'Bob', 
        picture: 'profilePic' 
      }
    };
    return _.extend(defaults, overwrites);
  }
};
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

describe('Poll', function () {

  var user;

  var data; //will be removed
 
  beforeEach(function () {
    user = new User({
      name: 'Bob',
      picture: 'profilePic'
    });
  });

  it('should publish and return a new poll', function () {
    var data = createPollData();
    var expectAndValidate = function (poll) {
      expect(poll.createdBy.userId.toString()).to.equal(user.id.toString());
      expect(poll).to.have.deep.property('createdBy.name', 'Bob');
      expect(poll).to.have.deep.property('createdBy.picture', 'profilePic');

      expect(poll).to.have.property('question', 'which sports?');
      expect(poll).to.have.deep.property('answer1.text', 'basketball');
      expect(poll).to.have.deep.property('answer1.picture', 'a1picurl');
      expect(poll).to.have.deep.property('answer1.numVotes', 0);
      expect(poll).to.have.deep.property('answer2.text', 'soccer');
      expect(poll).to.have.deep.property('answer2.picture', 'a2picurl');
      expect(poll).to.have.deep.property('answer2.numVotes', 0);
    };
    var promise = Poll.publish(user, data).then(function (poll) {
      expectAndValidate(poll);
      return Poll.getById(poll.id);
    }).then(function (poll) {
      expectAndValidate(poll);
    });
    return expect(promise).to.eventually.be.fulfilled; 
  });
  
  it('should get polls in decending order by id for a user', function () {
    var poll1 = createPollData({ question: 'poll1' }),
        poll2 = createPollData({ question: 'poll2' }),
        poll3 = createPollData({ question: 'poll3' }),
        user2 = new User({ name: 'Sam', picture: 'pfpic' });

    var promise = Poll.publish(user, poll1).then(function (poll1) {
      return Poll.publish(user2, poll3);
    }).then(function () {
      return Poll.publish(user, poll2);
    }).then(function () {
      return Poll.getByUserId(user.id);
    });

    return expect(promise).to.be.fulfilled.then(function (polls) {
      expect(polls).to.have.length(2);
      expect(polls[0].question).to.equal(poll2.question);
      expect(polls[1].question).to.equal(poll1.question);
    });
  });
  
  it('should exclude array values on #getByUserId', function () {
    var poll1 = createPollData({ question: 'poll1' });

    var promise = Poll.publish(user, poll1).then(function (poll1) {
    }).then(function () {
      return Poll.getByUserId(user.id);
    });

    return expect(promise).to.be.fulfilled.then(function (polls) {
      expect(polls[0].answer1.voters).to.be.undefined;
      expect(polls[0].answer2.voters).to.be.undefined;
      expect(polls[0].comments).to.be.undefined;
      expect(polls[0].votes).to.be.undefined;
    });

  });
  
  it('should limit the number of result', function () {
    var poll1 = createPollData({ question: 'poll1' }),
        poll2 = createPollData({ question: 'poll2' });

    var promise = Poll.publish(user, poll1).then(function (poll1) {
      return Poll.publish(user, poll2);
    }).then(function () {
      return Poll.getByUserId(user.id, null, 1);
    });

    return expect(promise).to.eventually.have.length(1);
  });

  it('should get polls before provided poll id with limit', function () {
    var poll1 = createPollData({ question: 'poll1' }),
        poll2 = createPollData({ question: 'poll2' }),
        poll3 = createPollData({ question: 'poll3' }),
        poll4 = createPollData({ question: 'poll4' }),
        poll3Id;

    var promise = Poll.publish(user, poll1).then(function () {
      return Poll.publish(user, poll2);
    }).then(function () {
      return Poll.publish(user, poll3);
    }).then(function (poll) {
      poll3Id = poll.id;
      return Poll.publish(user, poll4);
    }).then(function () {
      return Poll.getByUserId(user.id, poll3Id, 1);
    });

    return expect(promise).to.be.fulfilled.then(function (polls) {
      expect(polls).to.have.length(1);
      expect(polls[0].question).to.equal('poll2');
    });
  });

  it('should vote an answer for the poll', function () {
    var user2 = new User({ name: 'Sam', picture: 'pfpic' });
    var pollId;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id, 1);
    }).then(function () {
      return Poll.voteAnswer(pollId, user2.id, 2);
    }).then(function () {
      return Poll.getById(pollId);
    });
    return expect(promise).to.be.fulfilled.then(function (poll) {
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id);
      expect(poll.answer2.numVotes).to.equal(1);
      expect(poll.answer2.voters[0].toString()).to.equal(user2.id);
    });
  });

  it('should return updated poll when voted', function () {
    var pollId;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.voteAnswer(poll.id, user.id, 1);
    });
    return expect(promise).to.be.fulfilled.then(function (poll) {
      expect(poll.id).to.equal(pollId);
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id);
    });
  });

  it('should give error when vote with invalid answerNumber', function () {
    var pollId;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id);
    });
    return expect(promise).to.be
      .rejectedWith('Invalid answer: answer must be either number 1 or 2');
  });

  it('should not vote same poll twice with same user', function () {
    var pollId;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id, 1);
    }).then(function () {
      return Poll.voteAnswer(pollId, user.id, 1);
    }).then(function () {
      return Poll.voteAnswer(pollId, user.id, 2);
    }).then(function () {
      return Poll.getById(pollId); 
    });

    return expect(promise).to.be.fulfilled.then(function (poll) {
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id);
      expect(poll.answer2.numVotes).to.equal(0);
      expect(poll.answer2.voters).to.be.empty;
    });
  });

  it('should add comment to a poll and return updated poll', function () {
    var pollId, poll;
    var id = mongoose.Types.ObjectId();
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'hello');
    }).then(function (result) {
      poll = result;
      return Poll.getComments(pollId);
    });
    return expect(promise).to.be.fulfilled.then(function (comments) {
      expect(poll.comments[0]).to.have.property('_id');
      expect(poll.comments[0]).to.have.property('text', 'hello');
      expect(poll.comments[0].createdBy.userId.toString()).to.equal(user.id);
      expect(poll.comments[0]).to.have.deep.property('createdBy.name', user.name);
      expect(poll.comments[0]).to.have.deep.property('createdBy.picture', user.picture);

      expect(comments[0]).to.have.property('_id');
      expect(comments[0]).to.have.property('text', 'hello');
      expect(comments[0].createdBy.userId.toString()).to.equal(user.id);
      expect(comments[0]).to.have.deep.property('createdBy.userId');
      expect(comments[0]).to.have.deep.property('createdBy.name', user.name);
      expect(comments[0]).to.have.deep
        .property('createdBy.picture', user.picture);
    });
  });

  it('should update number of comments of the poll', function () {
    var pollId;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'hello');
    }).then(function () {
      return Poll.getById(pollId);
    });

    return expect(promise).to.eventually.have.property('numComments', 1);
  });
  
  it('should get empty array for comments', function () {
    var promise = Poll.getComments(mongoose.Types.ObjectId());
    return expect(promise).to.eventually.be.an('array').that.is.empty;
  });

  it('should paginate comments on getComments', function () {
    var options = { skip: 1, limit: 2 };

    var pollId, comment;
    var promise = Poll.publish(user, createPollData()).then(function (poll) {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'first');
    }).then(function () {
      return Poll.comment(pollId, user, 'second');
    }).then(function () {
      return Poll.comment(pollId, user, 'third');
    }).then(function () {
      return Poll.comment(pollId, user, 'fourth');
    }).then(function () {
      return Poll.getComments(pollId, options);
    });

    return expect(promise).to.be.fulfilled.then(function (comments) {
      expect(comments).to.be.length(2); 
      expect(comments[0].text).to.equal('second');
      expect(comments[1].text).to.equal('third');
    });
  });

  it('should have #toJSON to get clean json', function () {
    data = dataFactory.create();
    data.someWeird = "adsjfklsdfjalsdfjsalkdfjskldf";
    var poll = new Poll(data);
    expect(poll.toJSON()).to.have.property('id');
    expect(poll.toJSON()).to.not.have.property('_id');
    expect(poll.toJSON()).to.not.have.property('__V');
    expect(poll.toJSON()).to.not.have.property('_random');
  });
//////////////////////////////////////////////////////////////////////////
  describe('.createNew', function () {

    beforeEach(function () {
      data = dataFactory.create({answer1: { text: 'test' }}); 
    });

    it('should create a new poll', function () {
      return expect(Poll.createNew(data)).to.be.fulfilled
        .then(function (poll) {
        expect(poll).to.have.deep.property('createdBy.userId').to.be.ok;
        expect(poll).to.have.deep.property('createdBy.name', 'Bob');

        expect(poll).to.have.deep.property('subject1.text', 'Basketball');
        expect(poll).to.have.deep.property('subject2.text', 'Soccer');
        expect(poll).to.have.property('_random').to.be.ok.and.a('Number');
      });
    });

    it('should create a new poll with correct default fields', function () {
      return expect(Poll.createNew(data)).to.be.fulfilled
        .then(function (poll) {
        expect(poll).to.have.property('createdAt').to.be.a('date');
        expect(poll).to.have.property('updatedAt').to.be.a('date');
        expect(poll).to.have.deep.property('subject1.numVotes', 0);
        expect(poll).to.have.deep.property('subject2.numVotes', 0);
        expect(poll).to.have.property('totalNumVotes', 0);
        expect(poll).to.have.property('votes').to.be.ok.and.empty;
        // expect(poll).to.have.property('_random').to.be.an('Array').length(2);
      });
    });

    // it('should be rejected when required fields are missing', function () {
    //   return expect(Poll.createNew({})).to.be.rejected.then(function (e) {
    //     expect(e).to.match(/createdBy.userId is required!/);
    //     expect(e).to.match(/createdBy.name is required!/);
    //     expect(e).to.match(/subject1.text is required!/);
    //     expect(e).to.match(/subject2.text is required!/);
    //   });
    // });

    it('should have subjectTexts fields with subject texts', function () {
      return expect(Poll.createNew(data)).to.eventually.have
        .property('subjectTexts')
        .that.include.members(['Basketball', 'Soccer']);
    });
  });
  
  describe('.findOneRandom', function () {
    beforeEach(function () {
      sinon.stub(Poll, 'findOneAsync');
      sinon.stub(Math, 'random').returns(0.5);
      Poll.findOneAsync.onFirstCall().returns(Promise.resolve({ id: 123 }));
    });
    afterEach(function () {
      Poll.findOneAsync.restore();
      Math.random.restore();
    });

    it('should return a promise that resolves to a poll', function () {
      return expect(Poll.findOneRandom())
              .to.eventually.deep.have.property('id', 123);
    });

    it('should call first findOneAsync with random query', function () {
      return expect(Poll.findOneRandom()).to.be.fulfilled
      .then(function (poll) {
        expect(poll).to.have.property('id', 123);
        expect(Poll.findOneAsync).to.have.been
          .calledWith({ _random: { $gte: 0.5 }});
      });
    });

    describe('when first find query returns null', function () {

      beforeEach(function () {
        Poll.findOneAsync.onFirstCall().returns(Promise.resolve(null));
        Poll.findOneAsync.onSecondCall().returns(Promise.resolve({ id: 123 }));
      });

      it('should call find again with diffrent random query', function () {
        return expect(Poll.findOneRandom()).to.be.fulfilled
        .then(function (poll) {
          expect(Poll.findOneAsync.firstCall)
            .to.have.been.calledWith({ _random: { $gte: 0.5 }});
          expect(Poll.findOneAsync.secondCall)
            .to.have.been.calledWith({ _random: { $lte: 0.5 }});
        });
      });

      it('should take and append optional query', function () {
        var query = { 'votes.id': { $ne: 123 } };
        return expect(Poll.findOneRandom(query)).to.be.fulfilled
        .then(function (poll) {
          expect(Poll.findOneAsync.firstCall)
            .to.have.been.calledWith({
              'votes.id': { $ne: 123 },
              '_random': { $gte: 0.5 }
           });
          expect(Poll.findOneAsync.secondCall)
            .to.have.been.calledWith({
              'votes.id': { $ne: 123 },
              '_random': { $lte: 0.5 }
           });
        });
      });

      it('should take optional field', function () {
        var field = 'tags';
        return expect(Poll.findOneRandom({}, field)).to.be.fulfilled
        .then(function (poll) {
          expect(Poll.findOneAsync.firstCall)
            .to.have.been.calledWith({'_random': { $gte: 0.5 } }, 'tags');
          expect(Poll.findOneAsync.secondCall)
            .to.have.been.calledWith({'_random': { $lte: 0.5 } }, 'tags');
        });
      });

      it('should take optional options object', function () {
        var options = {};
        return expect(Poll.findOneRandom({}, null, options)).to.be.fulfilled
        .then(function (poll) {
          expect(Poll.findOneAsync.firstCall).to.have.been
            .calledWith({'_random': { $gte: 0.5 } }, null, options);
          expect(Poll.findOneAsync.secondCall).to.have.been
            .calledWith({'_random': { $lte: 0.5 } }, null, options);
        });
      });
    });
  });
  
  describe('#addVote', function () {

    var poll, voterId;

    beforeEach(function () {
      voterId = mongoose.Types.ObjectId();
      poll = new Poll(dataFactory.create()); 
      sinon.stub(poll, 'saveAsync', function () {
        return Promise.resolve([this, 1]); 
      });
    });

    it('should add a new vote and rturn promise', function () {
      return expect(poll.addVote(voterId, 1)).to.be.fulfilled
      .then(function (poll) {
        expect(poll.votes[0]).to.have.property('voterId', voterId);
        expect(poll.votes[0]).to.have.property('createdAt').to.be.a('date');
        expect(poll.votes[0]).to.have.property('subjectId', 1);
        expect(poll.votes[0]).to.have.property('subjectText', 'Basketball');
      });
    });

    it('should increase number of votes of the voted subject', function () {
      return expect(poll.addVote(voterId, 2)).to.eventually.have
        .deep.property('subject2.numVotes', 1);
    });

    it('should increase total number of votes of the poll', function () {
      return expect(poll.addVote(voterId, 2)).to.eventually.have
        .deep.property('totalNumVotes', 1);
    });

    it('should be rejected with error with invalid subjectId', function () {
      return expect(poll.addVote(voterId, 3)).to.eventually.be
        .rejectedWith('argument subjectId must be an integer 1 or 2');
    });
  });

});