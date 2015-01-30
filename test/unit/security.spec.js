'use strict';
/*jshint expr: true*/
var rewire = require('rewire'),
    chai = require('chai'),
    sinon = require('sinon'),
    sinonChai = require('sinon-chai'),
    Promise = require('bluebird'),
    chaiAsPromised = require("chai-as-promised"),
    crypto = require('crypto'),
    expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);


describe('security', function () {

  var security, req, res, mockJwt, mockConfig, mockUser, mockRequest;

  beforeEach(function () {
    // set up mocks and security Object
    req = { headers: {}, body: {}};
    res = {};

    mockJwt = { decode: sinon.stub(), encode: sinon.stub() };
    mockConfig = { 
      jwtsecret: 'testsecret', 
      aws: {
        bucket: 'dev.voteit',
        secretKey: 'testSecretKey'
      }
    };
    mockUser = { findByIdAsync: sinon.stub(), findOneAsync: sinon.stub() };
    mockRequest = sinon.stub();

    // stub global Date on now
    sinon.stub(Date, 'now').returns(1417876057391);

    // load module
    security = rewire('../../lib/security');
    security.__set__({
      jwt: mockJwt,
      config: mockConfig,
      User: mockUser,
      request: mockRequest
    });
  });

  afterEach(function () {
    Date.now.restore(); // restore stub on global Date.now
  });

  describe('#verifyToken', function () {

    var verifyToken, TOKEN;

    beforeEach(function () {
      TOKEN = 'some token';
      req.body = { access_token: TOKEN };
      // set default behaviour of mocks
      mockJwt.decode
        .withArgs(TOKEN, 'testsecret').returns({
          iss: 321, //user id
          exp: Date.now() + (60*24*60*60*1000)
        });

      verifyToken = security.verifyToken;
    });

    describe('with valid token', function () {

      beforeEach(function () {
        mockUser.findByIdAsync.withArgs(321)
            .returns(Promise.resolve({ user: 'json'}));
      });

      it('should resolve to user', function () {
        return expect(verifyToken(req, res))
                .to.eventually.deep.equal({ user: 'json'});
      });

      it('should attach user to req object', function () {
        return expect(verifyToken(req, res)).to.be.fulfilled.then(function () {
          expect(req.user).to.deep.equal({ user: 'json'});
        });
      });

      it('should get token from req.query', function () {
        req.body = null;
        req.query = { access_token: TOKEN };
        return expect(verifyToken(req, res))
                .to.eventually.deep.equal({ user: 'json'});
      });

      it('should get token from req.headers', function () {
        req.body = null;
        req.headers = { 'x-access-token': TOKEN };
        return expect(verifyToken(req, res))
                .to.eventually.deep.equal({ user: 'json'});
      });

      it('should reject with 401 error if user not found', function () {
        mockUser.findByIdAsync.withArgs(321).returns(Promise.resolve(null));

        return expect(verifyToken(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(401); 
          expect(e.message).to.equal('User not found with the token'); 
        });
      });
    });

   describe('with an Invalid token', function () {

      it('should reject with 401 with missing token', function () {
        req.body = {};
        return expect(verifyToken(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(401);
          expect(e.message).to.equal('Valid access token is required');
        });
      });

      it('should reject with decoding error', function () {
        mockJwt.decode.withArgs(TOKEN, 'testsecret')
        .throws(new Error("decode err"));
        return expect(verifyToken(req, res)).to.be.rejectedWith('decode err');
      });

      it('should reject with 401 when token is expired', function () {
        var expTokenDecoded = {
          iss: 123, 
          exp: Date.now() - (60*24*60*60*1000)
        };
        mockJwt.decode.withArgs(TOKEN, 'testsecret').returns(expTokenDecoded);
        return expect(verifyToken(req, res)).to.be.rejectedWith('Access token has been expired');
      });
    });
  });
  
  describe('#login', function () {

    var login, user, s3Policy;

    beforeEach(function () {
      user = { 
        id: 123,
        email: 'bob@home.net',
        name: 'Bob Jhon',
        facebookId: 'facebookId123',
        comparePassword: sinon.stub().withArgs('testPwd')
          .returns(Promise.resolve(true))
      };
      s3Policy = {
         "expiration": new Date(Date.now() + (120*24*60*60*1000)),
          "conditions": [ 
            {"bucket": mockConfig.aws.bucket}, 
            ["starts-with", "$key", ""],
            {"acl": "public-read"},
            ["starts-with", "$Content-Type", ""],
            ["starts-with", "$filename", ""],
            ["content-length-range", 0, 1048576]
        ]
      };
      login = security.login; 
    });

    it('should return promise rejected with 400 error with no grantType field',
      function () {
      return expect(login(req, res)).to.be.rejected.then(function (e) {
        expect(e.status).to.equal(400);
        expect(e.message).to.equal('grantType field is missing or not valid');
      });
    });

    it('should return promise rejecte with 400 with invalid grantTpe field',
      function () {
      return expect(login(req, res)).to.be.rejected.then(function (e) {
        expect(e.status).to.equal(400);
        expect(e.message).to.equal('grantType field is missing or not valid');
      });
    });

    describe('with password', function () {

      beforeEach(function () {
        req.body = {
          email: 'bob@home.net',
          password: 'testPwd',
          grantType: 'password'
        };
        mockUser
          .findOneAsync
          .withArgs({ email: 'bob@home.net' })
          .returns(Promise.resolve(user));
      });

      it('should return a promise', function () {
        expect(login(req, res)).to.be.an('object');
        expect(login(req, res).then).to.be.a('function');
      });

      it('should be resolved to an object', function () {
        return expect(login(req, res)).to.eventually.be.an('object');
      });

      it('should be resolved to object containing user', function () {
        return expect(login(req, res))
                .to.eventually.have.deep.property('user', user);
      });

      it('should be resolved to object containing access_token', function () {
        mockJwt.encode
          .withArgs({
            iss: 123,
            exp: Date.now() + (60*24*60*60*1000)
          }, 'testsecret').returns('FAKE ACCESS TOKEN');

        return expect(login(req, res))
                .to.eventually.have.deep
                .property('access_token', 'FAKE ACCESS TOKEN');
      });

      // it('should be resolved to object containing aws s3 signed policy and signiture', function () {

      //   var policy = new Buffer(JSON.stringify(s3Policy))
      //       .toString('base64'); 
      //   var sig = new Buffer(crypto.createHmac('sha1', mockConfig.aws.secretKey)
      //       .update(policy)
      //       .digest()).toString('base64');

      //   return login(req, res).then(function (result) {
      //     expect(result).to.have.property('aws');
      //     expect(result.aws.bucket).to.equal(mockConfig.aws.bucket);
      //     expect(result.aws.s3Policy).to.equal(policy);
      //     expect(result.aws.s3Signiture).to.equal(sig);
      //   });
      // });


      it('should be rejected with 401 with missing email', function () {
        req.body.email = undefined;
        return expect(login(req, res)).to.be.rejected.then(function (e) { 
          expect(e.status).to.equal(401); 
          expect(e.message).to.equal('Invalid credentials');
        });
      });

      it('should be rejected with 401 with missing password', function () {
        req.body.password = '';
        user.comparePassword.returns(Promise.resolve(false));

        return expect(login(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(401); 
          expect(e.message).to.equal('Invalid credentials');
        });
      });

      it('should be rejected with 401 error with wrong password', function () {
        req.body.password = 'wrong';
        user.comparePassword.returns(Promise.resolve(false));

        return expect(login(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(401); 
          expect(e.message).to.equal('Password is not correct');
        });
      });

      it('should be rejected with 401 error with wrong password', function () {
        req.body.email = 'nonExistingUser';
        mockUser.findOneAsync.returns(Promise.resolve(null));

        return expect(login(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(401); 
          expect(e.message).to.equal('Can\'t find a user with that email');
        });
      });
    });

    describe('with facebook access token', function () {

      beforeEach(function () {
        req.body.grantType = 'facebook';
        req.body.facebookAccessToken = 'FAKEFBTOKEN';
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{ "id": "facebookId123", "email": "bob@home.net", "name": "Bob Jhon"}'
        ]));
        mockUser
          .findOneAsync
          .withArgs({ 'facebook.id': 'facebookId123' })
          .returns(Promise.resolve(user));
      });

      it('should return a promise', function () {
        expect(login(req, res)).to.be.an('object');
        expect(login(req, res).then).to.be.a('function');
      });

      it('should reject with 400 when facebook token is missing', function () {
        req.body.facebookAccessToken = undefined;
        return expect(login(req, res)).to.be.rejected.then(function (e) {
          expect(e.status).to.equal(400);
          expect(e.message).to.equal('A facebook access token is required');
        });
      });

      it('should send request to facebook to get profile', function () {
        return expect(login(req, res)).to.be.fulfilled.then(function () {
          expect(mockRequest).to.have.been
            .calledWith('https://graph.facebook.com/me?field=id,email,name&access_token=FAKEFBTOKEN');
        });
      });

      it('should reject with 500 when it fails to get profile from facebook',
        function () {
        mockRequest.returns(Promise.resolve([{
          statusCode: 400
        },
        '{ "id": "facebookId123", "email": "bob@home.net"}'
        ]));

        return expect(login(req, res)).to.be.rejected.then(function (e) {
          expect(e).to.deep.equal({
            name: 'FacebookGraphAPIError',
            message: "Failed to fetch facebook user profile",
            status: 500 
          }); 
        });

      });

      it('should be resolved to object containing user', function () {
        return expect(login(req, res))
                .to.eventually.have.deep.property('user', user);
      });

      it('should be resolved to object containing access_token', function () {
        mockJwt.encode
          .withArgs({
            iss: 123,
            exp: Date.now() + (60*24*60*60*1000)
          }, 'testsecret').returns('FAKE ACCESS TOKEN');

        return expect(login(req, res))
                .to.eventually.have.deep
                .property('access_token', 'FAKE ACCESS TOKEN');
      });

      // it('should be resolved to object containing aws s3 signed policy and signiture', function () {

      //   var policy = new Buffer(JSON.stringify(s3Policy))
      //       .toString('base64'); 
      //   var sig = new Buffer(crypto.createHmac('sha1', mockConfig.aws.secretKey)
      //       .update(policy)
      //       .digest()).toString('base64');

      //   return login(req, res).then(function (result) {
      //     expect(result).to.have.property('aws');
      //     expect(result.aws.bucket).to.equal(mockConfig.aws.bucket);
      //     expect(result.aws.s3Policy).to.equal(policy);
      //     expect(result.aws.s3Signiture).to.equal(sig);
      //   });
      // });

      it('should create a new user when there\'s no user with given fb id',
        function () {

        // predefine result for facebook profile request
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{ "id": "newFbId12345", "email": "sam@home.net", "name": "Sam Power"}'
        ]));

        // findOneAsync behaviour
        mockUser
        .findOneAsync
        .withArgs({ 'facebook.id': 'newFbId12345' })
        .returns(Promise.resolve(null));        

        var newUser = { 
          id:234, 
          email: 'sam@home.net', 
          name: 'Sam Power',
          facebook: {id: 'newFbId12345'}
        };
        mockUser.createAsync = sinon.stub().returns(Promise.resolve(newUser));

        return expect(login(req, res)).to.eventually
          .have.deep.property('user', newUser).then(function () {

          expect(mockUser.createAsync).have.been.calledWith({
            email: 'sam@home.net',
            name: 'Sam Power',
            facebook: {id: 'newFbId12345', name: 'Sam Power' }
          });
        });

      });

    });
  });
});