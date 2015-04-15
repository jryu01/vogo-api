'use strict';
/*jshint expr: true*/
var methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    Promise = require('bluebird'),
    request = require('supertest'),
    express = require('express'),
    rewire = require('rewire'),
    Poll = require('./poll'),
    Vote = require('./vote');
    
var router = rewire('./pollRouter');

var user = { 
  id: '507f1f77bcf86cd799439011', 
  email: 'test@user.com', 
  name: 'Test User' 
};
var mockRequireToken = function (req, res, next) {
  var token = req.headers['x-access-token'];
  if (token !== 'testToken') { 
    return res.status(401).end();
  }
  req.user = user;
  next();
};

var createApp = function () {
  var app = express(); 
  app.use(bodyParser.json());
  app.use(methodOverride());
  router.__set__({
    requireToken: mockRequireToken   
  });
  app.use(router());
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json(err);
  });
  return app;
};


describe('Poll Router', function () {
  
  var app = createApp();

  describe('POST /polls', function () {

    beforeEach(function () { sinon.stub(Poll, 'publish'); });
    afterEach(function () { Poll.publish.restore(); });  

    it('should require an access token', function (done) {
      request(app).post('/polls').expect(401, done);
    });

    it('should send 201 with created poll data', function (done) {
      var reqBody = {
        question: 'which answer?',
        answer1: { text: 'left answer', picture: 'pic' },
        answer2: { text: 'right answer', picture: 'pic2' }
      };
      Poll.publish.withArgs(user, reqBody).returns(Promise.resolve({
        question: 'Created Poll'
      }));
      request(app).post('/polls')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(201, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body).to.have.property('question', 'Created Poll');
          done();
        });
    });
  });

  describe('POST /polls/:id/votes', function () {
    
    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { sinon.stub(Vote, 'createNew'); });
    afterEach(function () { Vote.createNew.restore(); });  

    it('should require an access token', function (done) {
      request(app).post('/polls/' + pollId + '/votes').expect(401, done);
    });

    it('should send 201 with created vote data', function (done) {
      var reqBody = { answer: 1 };
      Vote.createNew.withArgs(user.id, pollId, 1).returns(Promise.resolve({
        voterId: user.id,
        answer: 1,
        _poll: 'fakepoll'
      }));
      request(app).post('/polls/' + pollId + '/votes')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(201, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body).to.have.property('voterId', user.id);
          expect(res.body).to.have.property('answer', 1);
          expect(res.body).to.have.property('_poll', 'fakepoll');
          done();
        });
    });
  });

  describe('POST /polls/:id/comments', function () {

    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { sinon.stub(Poll, 'comment'); });
    afterEach(function () { Poll.comment.restore(); });  

    it('should require an access token', function (done) {
      request(app).post('/polls/' + pollId + '/comments').expect(401, done);
    });

    it('should send 201 with created comments', function (done) {
      var reqBody = { text: 'new comment' };
      Poll.comment.withArgs(pollId, user, 'new comment')
        .returns(Promise.resolve({
          comments: [{text: 'old comment'}, {text: 'new comment'}]
        }));
      request(app).post('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(201, {text: 'new comment'}, done);
    });

    it('should send 404 with non existing poll', function (done) {
      var reqBody = { text: 'new comment' };
      Poll.comment.withArgs(pollId, user, 'new comment')
        .returns(Promise.resolve(null));
      request(app).post('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(404, { status: 404, message: 'poll not found' }, done);
    });
  });

  describe('GET /polls/:id/comments', function () {

    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { sinon.stub(Poll, 'getComments'); });
    afterEach(function () { Poll.getComments.restore(); });  

    it('should require an access token', function (done) {
      request(app).get('/polls/' + pollId + '/comments').expect(401, done);
    });

    it('should send 200 with comments', function (done) {
      Poll.getComments.withArgs(pollId, { skip: 0, limit: 20 })
        .returns(Promise.resolve([{text: 'comment1'}, {text: 'comment2'}]));

      request(app).get('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .expect(200, [{text: 'comment1'}, {text: 'comment2'}], done);
    });

    it('should paginate comments', function (done) {
      Poll.getComments.withArgs(pollId, { skip: 20, limit: 2})
        .returns(Promise.resolve([{text: 'comment1'}, {text: 'comment2'}]));
        
      request(app).get('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .query({ skip: 20, limit: 2 })
        .expect(200, [{text: 'comment1'}, {text: 'comment2'}], done);
    });

  });

  describe('GET /polls/:id', function () {

    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { sinon.stub(Poll, 'getById'); });
    afterEach(function () { Poll.getById.restore(); });  

    it('should require an access token', function (done) {
      request(app).get('/polls/' + pollId).expect(401, done);
    });

    it('should send 200 with a poll', function (done) {
      Poll.getById.withArgs(pollId)
        .returns(Promise.resolve({ id: pollId }));

      request(app).get('/polls/' + pollId)
        .set('x-access-token', 'testToken')
        .expect(200, { id: pollId }, done);
    });
  });

});