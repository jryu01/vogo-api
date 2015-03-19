'use strict';

var express = require('express'),
    bodyParser = require('body-parser'),
    request = require('supertest'),
    Promise = require('bluebird'),
    rewire = require('rewire');


describe('Middleware', function () {

  var mw, mockJwt, mockUser, mockConfig;

  beforeEach(function () {

    mockJwt = { decode: sinon.stub(), encode: sinon.stub() };
    mockConfig = { 
      jwtsecret: 'testsecret', 
      aws: {
        bucket: 'dev.voteit',
        secretKey: 'testSecretKey'
      }
    };
    mockUser = { findByIdAsync: sinon.stub(), findOneAsync: sinon.stub() };
    mw = rewire('app/middleware');
    mw.__set__({
      jwt: mockJwt,
      User: mockUser,
      config: mockConfig
    });
  });

  describe('#requiresAccessToken', function () {

    var app, reqObj, TOKEN;

    beforeEach(function () {
      app = express();
      app.use(bodyParser.json());
      app.use(function (req, res) {
        mw.requiresAccessToken(req, res, function (err) {
          reqObj = req;
          res.statusCode = err ? (err.status || 500) : 200;
          res.end(err ? err.message : JSON.stringify(req.body));
        });
      });
    });

    beforeEach(function () {
      TOKEN = 'some token';
      // set default behaviour of mocks
      mockJwt.decode
        .withArgs(TOKEN, 'testsecret').returns({
          iss: 321, //user id
          exp: Date.now() + (60*24*60*60*1000)
        });
    });

    describe('with valid token', function () {

      beforeEach(function () {
        mockUser.findByIdAsync.withArgs(321)
            .returns(Promise.resolve({ user: 'json'}));
      });

      it('should attach user to req object', function (done) {
        request(app).get('/')
          .set('x-access-token', TOKEN)
          .expect(200, function (err, res) {
            if (err) { return done(err); }
            expect(reqObj.user).to.deep.equal({ user: 'json'});
            done();
          });
      });

      it('should get token from query strings', function (done) {
        request(app).get('/')
          .query({ access_token: TOKEN })
          .expect(200, done);
      });

      it('should get token from body', function (done) {
        request(app).post('/')
          .send({ 'access_token': TOKEN })
          .expect(200, done);
      });

      it('should reject with 401 error if user not found', function (done) {
        mockUser.findByIdAsync.withArgs(321).returns(Promise.resolve(null));

        request(app).get('/')
          .set('x-access-token', TOKEN)
          .expect(401, 
            '{"status":401,"message":"User not found with the token"}', done);
      });
    });

  //  describe('with an Invalid token', function () {

  //     it('should reject with 401 with missing token', function () {
  //       req.body = {};
  //       return expect(requiresAccessToken(req, res)).to.be.rejected.then(function (e) {
  //         expect(e.status).to.equal(401);
  //         expect(e.message).to.equal('Access token is missing!');
  //       });
  //     });

  //     it('should reject with decoding error', function () {
  //       mockJwt.decode.withArgs(TOKEN, 'testsecret')
  //       .throws(new Error("decode err"));
  //       return expect(requiresAccessToken(req, res)).to.be.rejected.then(function (e) {
  //         expect(e.status).to.equal(401);
  //         expect(e.message).to.equal('Access token is not a valid token!');
  //       });
  //     });

  //     it('should reject with 401 when token is expired', function () {
  //       var expTokenDecoded = {
  //         iss: 123, 
  //         exp: Date.now() - (60*24*60*60*1000)
  //       };
  //       mockJwt.decode.withArgs(TOKEN, 'testsecret').returns(expTokenDecoded);
  //       return expect(requiresAccessToken(req, res)).to.be.rejectedWith('Access token has been expired');
  //     });
  //   });
  });
});