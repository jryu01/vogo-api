/* eslint no-unused-expressions: 0 */
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import Promise from 'bluebird';
import request from 'supertest';
import express from 'express';
import rewire from 'rewire';
import Poll from './poll';
import Vote from './vote';

const router = rewire('./router');

const user = {
  id: '507f1f77bcf86cd799439011',
  email: 'test@user.com',
  name: 'Test User'
};

const mockRequireToken = (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (token !== 'testToken') {
    return res.status(401).end();
  }
  req.user = user;
  next();
};

const createApp = () => {
  const app = express();
  app.use(bodyParser.json());
  router.__set__({
    requireToken: mockRequireToken
  });
  app.use(router());
  return app;
};


describe('Poll Router', () => {
  const app = createApp();

  it('should require authentication token', done => {
    request(app).post('/anyRoute').expect(401, done);
  });

  describe('POST /polls', () => {
    beforeEach(() => sinon.stub(Poll, 'publish'));
    afterEach(() => Poll.publish.restore());

    it('should send 201 with created poll data', done => {
      const reqBody = {
        question: 'which answer?',
        answer1: { text: 'left answer', picture: 'pic' },
        answer2: { text: 'right answer', picture: 'pic2' }
      };
      Poll.publish.withArgs(user, reqBody).returns(Promise.resolve({
        question: 'Created Poll'
      }));
      request(app).post('/polls')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .send(reqBody)
        .expect(201, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.have.property('question', 'Created Poll');
          done();
        });
    });
  });

  describe('POST /polls/:id/votes', () => {
    const pollId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Vote, 'createNew'));
    afterEach(() => Vote.createNew.restore());

    it('should send 201 with result', done => {
      const reqBody = { answer: 1 };
      Vote.createNew.withArgs(user.id, pollId, 1)
        .returns(Promise.resolve('result'));

      request(app).post('/polls/' + pollId + '/votes')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .send(reqBody)
        .expect(201, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.equal('result');
          done();
        });
    });

    it('should send 404 with non-existing poll', done => {
      const reqBody = { answer: 1 };
      const expected = /poll not found or already voted with the user/;
      Vote.createNew.withArgs(user.id, pollId, 1)
        .returns(Promise.resolve(null));
      request(app).post('/polls/' + pollId + '/votes')
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(404, expected, done);
    });
  });

  describe('POST /polls/:id/comments', () => {
    const pollId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Poll, 'comment'));
    afterEach(() => Poll.comment.restore());

    it('should send 201 with created comments', done => {
      const reqBody = { text: 'new comment' };
      Poll.comment.withArgs(pollId, user, 'new comment')
        .returns(Promise.resolve({
          comments: [{text: 'old comment'}, {text: 'new comment'}]
        }));
      request(app).post('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .send(reqBody)
        .expect(201, {text: 'new comment'}, done);
    });

    it('should send 404 with non existing poll', done => {
      const reqBody = { text: 'new comment' };
      const expected = /poll not found/;
      Poll.comment.withArgs(pollId, user, 'new comment')
        .returns(Promise.resolve(null));
      request(app).post('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .send(reqBody)
        .expect(404, expected, done);
    });
  });

  describe('GET /polls/:id/comments', () => {
    const pollId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Poll, 'getComments'));
    afterEach(() => Poll.getComments.restore());

    it('should send 200 with comments', done => {
      Poll.getComments.withArgs(pollId, { skip: 0, limit: 20 })
        .returns(Promise.resolve([{text: 'comment1'}, {text: 'comment2'}]));

      request(app).get('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .expect(200, [{text: 'comment1'}, {text: 'comment2'}], done);
    });

    it('should paginate comments', done => {
      Poll.getComments.withArgs(pollId, { skip: 20, limit: 2})
        .returns(Promise.resolve([{text: 'comment1'}, {text: 'comment2'}]));

      request(app).get('/polls/' + pollId + '/comments')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ skip: 20, limit: 2 })
        .expect(200, [{text: 'comment1'}, {text: 'comment2'}], done);
    });
  });

  describe('GET /polls/:id', () => {
    const pollId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Poll, 'getById'));
    afterEach(() => Poll.getById.restore());

    it('should send 200 with a poll', done => {
      Poll.getById.withArgs(pollId)
        .returns(Promise.resolve({ id: pollId }));

      request(app).get('/polls/' + pollId)
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .expect(200, { id: pollId }, done);
    });
  });

  describe('GET /users/:id/polls', () => {
    const userId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Poll, 'getByUserId'));
    afterEach(() => Poll.getByUserId.restore());

    it('should send 200 with data', done => {
      Poll.getByUserId.withArgs(userId, null, 20)
        .returns(Promise.resolve({ question: 'poll?' }));

      request(app).get('/users/' + userId + '/polls').query({ limit: 20 })
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .expect(200, { question: 'poll?'}, done);
    });

    it('should send 200 with before query parameter', done => {
      const pollId = mongoose.Types.ObjectId().toString();
      Poll.getByUserId.withArgs(userId, pollId, 20)
        .returns(Promise.resolve({ question: 'poll?' }));

      request(app).get('/users/' + userId + '/polls')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ before: pollId })
        .expect(200, { question: 'poll?'}, done);
    });
  });

  describe('GET /users/:id/votes', () => {
    const userId = mongoose.Types.ObjectId().toString();

    beforeEach(() => {
      sinon.stub(Vote, 'getByUserId');
      sinon.stub(Vote, 'getByUserIdAndPollIds');
    });
    afterEach(() => {
      Vote.getByUserId.restore();
      Vote.getByUserIdAndPollIds.restore();
    });

    it('should send 200 with data', done => {
      Vote.getByUserId.withArgs(userId, null, 20)
        .returns(Promise.resolve({ id: 1 }));

      request(app).get('/users/' + userId + '/votes')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ limit: 20})
        .expect(200, { id: 1 }, done);
    });

    it('should send 200 with before query parameter', done => {
      const voteId = mongoose.Types.ObjectId().toString();
      Vote.getByUserId.withArgs(userId, voteId, 20)
        .returns(Promise.resolve( { id: 1 }));

      request(app).get('/users/' + userId + '/votes')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ before: voteId, limit: 20 })
        .expect(200, { id: 1 }, done);
    });

    it('should send 200 with pollIds query parameter', done => {
      const pollId = mongoose.Types.ObjectId().toString();
      Vote.getByUserIdAndPollIds.withArgs(userId, [pollId])
        .returns(Promise.resolve( { id: 2 }));

      request(app).get('/users/' + userId + '/votes')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ pollIds: [pollId] })
        .expect(200, { id: 2 }, done);
    });
  });

  describe('GET /polls/:id/voters', () => {
    const pollId = mongoose.Types.ObjectId().toString();

    beforeEach(() => sinon.stub(Vote, 'getVotersFor'));
    afterEach(() => Vote.getVotersFor.restore());

    it('should send 200 with data', done => {
      Vote.getVotersFor.withArgs(pollId, 1)
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ answer: 1 })
        .expect(200, [{ name: 'user1'}], done);
    });

    it('should paginate with limit and skip', done => {
      Vote.getVotersFor.withArgs(pollId, 2, { limit: 1, skip: 20 })
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ answer: 2, limit: 1, skip: 20 })
        .expect(200, [{ name: 'user1'}], done);
    });

    it('should paginate with default limit and skip value', done => {
      Vote.getVotersFor.withArgs(pollId, 2, { limit: 100, skip: 0 })
        .returns(Promise.resolve([{ name: 'user1' }]));

      request(app).get('/polls/' + pollId + '/voters')
        .set('x-access-token', 'testToken')
        .set('Accept', 'application/json')
        .query({ answer: 2 })
        .expect(200, [{ name: 'user1'}], done);
    });
  });
});
