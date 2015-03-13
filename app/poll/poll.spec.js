'use strict';
/*jshint expr: true*/

var _ = require('lodash'),
    mongoose = require('mongoose'),
    Promise = require('bluebird');

var dataFactory = {
  create: function (overwrites) {
    var defaults = {
      subject1: { text: 'Basketball' },
      subject2: { text: 'Soccer' },
      user: { id: '544ef523ef51cd394ba17326', name: 'Bob' }
    };
    return _.extend(defaults, overwrites);
  }
};

describe('Poll', function () {

  var Poll, data;
 
  beforeEach(function () {
    Poll = require('./poll');
  });

  describe('.createNew', function () {

    beforeEach(function () {
      data = dataFactory.create(); 
    });

    it('should create a new poll with correct fields', function () {
      return expect(Poll.createNew(data)).to.be.fulfilled
        .then(function (poll) {
        expect(poll).to.have.deep.property('createdBy.userId').to.be.ok;
        expect(poll).to.have.deep.property('createdBy.name', 'Bob');

        expect(poll).to.have.deep.property('subject1.text', 'Basketball');
        expect(poll).to.have.deep.property('subject2.text', 'Soccer');
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
        expect(poll).to.have.property('tags').to.be.ok.and.empty;
        expect(poll).to.have.property('_random').to.be.ok.and.a('Number');
        // expect(poll).to.have.property('_random').to.be.an('Array').length(2);
      });
    });

    it('should be rejected when required fields are missing', function () {
      return expect(Poll.createNew({})).to.be.rejected.then(function (e) {
        expect(e).to.match(/createdBy.userId is required!/);
        expect(e).to.match(/createdBy.name is required!/);
        expect(e).to.match(/subject1.text is required!/);
        expect(e).to.match(/subject2.text is required!/);
      });
    });

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

  it('should have #toJSON to get clean json', function () {
    data = dataFactory.create();
    data.someWeird = "adsjfklsdfjalsdfjsalkdfjskldf";
    var poll = new Poll(data);
    expect(poll.toJSON()).to.have.property('id');
    expect(poll.toJSON()).to.not.have.property('_id');
    expect(poll.toJSON()).to.not.have.property('__V');
    expect(poll.toJSON()).to.not.have.property('_random');
  });

});