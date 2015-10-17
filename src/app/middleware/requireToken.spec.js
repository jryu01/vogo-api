import express from 'express';
import bodyParser from 'body-parser';
import request from 'supertest';
import Promise from 'bluebird';
import rewire from 'rewire';

describe('Middleware: requiresToken', () => {
  const TOKEN = 'some token';
  let app;
  let reqObj;

  // setup mocks
  let requiresToken;
  let mockJwt;
  let mockUser;
  let mockConfig;

  beforeEach(() => {
    mockJwt = { decode: sinon.stub(), encode: sinon.stub() };
    mockConfig = {
      jwtsecret: 'testsecret',
      aws: {
        bucket: 'dev.voteit',
        secretKey: 'testSecretKey'
      }
    };
    mockUser = { findByIdAsync: sinon.stub(), findOneAsync: sinon.stub() };
    requiresToken = rewire('./requireToken');
    requiresToken.__set__({
      jwt: mockJwt,
      User: mockUser,
      config: mockConfig
    });

    app = express();
    app.use(bodyParser.json());
    app.use((req, res) => {
      requiresToken(req, res, err => {
        reqObj = req;
        res.statusCode = err ? (err.status || 500) : 200;
        res.end(err ? err.message : JSON.stringify(req.body));
      });
    });
  });

  beforeEach(() => {
    // set default behaviour of mocks
    mockJwt.decode
      .withArgs(TOKEN, 'testsecret').returns({
        iss: 321, // user id
        exp: Date.now() + (60 * 24 * 60 * 60 * 1000)
      });
  });

  describe('with valid token', () => {
    beforeEach(() => {
      mockUser.findByIdAsync.withArgs(321)
          .returns(Promise.resolve({ user: 'json'}));
    });

    it('should attach user to req object', done => {
      request(app).get('/')
        .set('x-access-token', TOKEN)
        .expect(200, err => {
          if (err) { return done(err); }
          expect(reqObj.user).to.deep.equal({ user: 'json'});
          done();
        });
    });

    it('should get token from query strings', done => {
      request(app).get('/')
        .query({ access_token: TOKEN })
        .expect(200, done);
    });

    it('should get token from body', done => {
      request(app).post('/')
        .send({ 'access_token': TOKEN })
        .expect(200, done);
    });

    it('should response with 401 if user not found', done => {
      mockUser.findByIdAsync.withArgs(321).returns(Promise.resolve(null));

      request(app).get('/')
        .set('x-access-token', TOKEN)
        .expect(401,
          '{"status":401,"message":"User not found with the token!"}', done);
    });
  });

  describe('with an Invalid token', () => {
    it('should response with 401 with missing token', done => {
      request(app).get('/')
        .expect(401,
          '{"status":401,"message":"Access token is missing!"}', done);
    });

    it('should response with 401 with decoding error', done => {
      mockJwt.decode.withArgs('invalidToken', 'testsecret')
      .throws(new Error('decode err'));

      request(app).get('/')
        .set('x-access-token', 'invalidToken')
        .expect(401,
          '{"status":401,"message":"Access token is not a valid token!"}',
          done);
    });

    it('should response with 401 when token is expired', done => {
      const expTokenDecoded = {
        iss: 123,
        exp: Date.now() - (60 * 24 * 60 * 60 * 1000)
      };
      mockJwt.decode.withArgs('expToken', 'testsecret')
        .returns(expTokenDecoded);

      request(app).get('/')
        .set('x-access-token', 'expToken')
        .expect(401,
          '{"status":401,"message":"Access token has been expired!"}',
          done);
    });
  });
});
