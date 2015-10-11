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
    
var router = rewire('./router');

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
    res.status(err.status);
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

    beforeEach(function () { 
      sinon.stub(Vote, 'createNew'); 
    });
    afterEach(function () { 
      Vote.createNew.restore(); 
    });

    it('should require an access token', function (done) {
      request(app).post('/polls/' + pollId + '/votes').expect(401, done);
    });

    it('should send 201 with result', function (done) {
      var reqBody = { answer: 1 };
      Vote.createNew.withArgs(user.id, pollId, 1).returns(Promise.resolve('result'));

      request(app).post('/polls/' + pollId + '/votes')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(201, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body).to.equal('result');
          done();
        });
    });

    it('should send 404 with non-existing poll', function (done) {
      var reqBody = { answer: 1 };
      Vote.createNew.withArgs(user.id, pollId, 1)
        .returns(Promise.resolve(null));
      request(app).post('/polls/' + pollId + '/votes')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(404, { status: 404, message: 'poll not found or already voted with the user' }, done);
    });
  });

  describe('POST /polls/:id/comments', function () {

    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { 
      sinon.stub(Poll, 'comment'); 
    });
    afterEach(function () { 
      Poll.comment.restore(); 
    });

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

  describe('GET /users/:id/polls', function () {

    var userId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { sinon.stub(Poll, 'getByUserId'); });
    afterEach(function () { Poll.getByUserId.restore(); });  

    it('should require an access token', function (done) {
      request(app).get('/users/' + userId + '/polls').expect(401, done);
    });

    it('should send 200 with data', function (done) {
      Poll.getByUserId.withArgs(userId, null, 20)
        .returns(Promise.resolve({ question: 'poll?' }));

      request(app).get('/users/' + userId + '/polls').query({ limit: 20 })
        .set('x-access-token', 'testToken')
        .expect(200, { question: 'poll?'}, done);
    });

    it('should send 200 with before query parameter', function (done) {
      var pollId = mongoose.Types.ObjectId().toString();
      Poll.getByUserId.withArgs(userId, pollId, 20)
        .returns(Promise.resolve({ question: 'poll?' }));

      request(app).get('/users/' + userId + '/polls')
        .query({ before: pollId })
        .set('x-access-token', 'testToken')
        .expect(200, { question: 'poll?'}, done);
    });
  });

  describe('GET /users/:id/votes', function () {

    var userId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { 
      sinon.stub(Vote, 'getByUserId'); 
      sinon.stub(Vote, 'getByUserIdAndPollIds'); 
    });
    afterEach(function () { 
      Vote.getByUserId.restore(); 
      Vote.getByUserIdAndPollIds.restore(); 
    });  

    it('should require an access token', function (done) {
      request(app).get('/users/' + userId + '/votes').expect(401, done);
    });

    it('should send 200 with data', function (done) {
      Vote.getByUserId.withArgs(userId, null, 20)
        .returns(Promise.resolve({ id: 1 }));

      request(app).get('/users/' + userId + '/votes').query({ limit: 20 })
        .set('x-access-token', 'testToken')
        .expect(200, { id: 1 }, done);
    });

    it('should send 200 with before query parameter', function (done) {
      var voteId = mongoose.Types.ObjectId().toString();
      Vote.getByUserId.withArgs(userId, voteId, 20)
        .returns(Promise.resolve( { id: 1 }));

      request(app).get('/users/' + userId + '/votes')
        .query({ before: voteId, limit: 20 })
        .set('x-access-token', 'testToken')
        .expect(200, { id: 1 }, done);
    });

    it('should send 200 with pollIds query parameter', function (done) {
      var pollId = mongoose.Types.ObjectId().toString();
      Vote.getByUserIdAndPollIds.withArgs(userId, [pollId])
        .returns(Promise.resolve( { id: 2 }));

      request(app).get('/users/' + userId + '/votes')
        .query({ pollIds: [pollId] })
        .set('x-access-token', 'testToken')
        .expect(200, { id: 2 }, done);
    });
  });

  describe('GET /polls/:id/voters', function () {

    var pollId = mongoose.Types.ObjectId().toString();

    beforeEach(function () { 
      sinon.stub(Vote, 'getVotersFor'); 
    });
    afterEach(function () { 
      Vote.getVotersFor.restore(); 
    });  

    it('should require an access token', function (done) {
      request(app).get('/polls/' + pollId + '/voters').expect(401, done);
    });

    it('should send 200 with data', function (done) {
      Vote.getVotersFor.withArgs(pollId, 1)
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .query({ answer: 1 })
        .set('x-access-token', 'testToken')
        .expect(200, [{ name: 'user1'}], done);
    });

    it('should paginate with limit and skip', function (done) {
      Vote.getVotersFor.withArgs(pollId, 2, { limit: 1, skip: 20 })
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .query({ answer: 2, limit: 1, skip: 20 })
        .set('x-access-token', 'testToken')
        .expect(200, [{ name: 'user1'}], done);
    });

    it('should paginate with default limit and skip value', function (done) {
      Vote.getVotersFor.withArgs(pollId, 2, { limit: 100, skip: 0 })
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .query({ answer: 2 })
        .set('x-access-token', 'testToken')
        .expect(200, [{ name: 'user1'}], done);
    });
  });

});