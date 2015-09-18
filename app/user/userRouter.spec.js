'use strict';
/*jshint expr: true*/
var methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    Promise = require('bluebird'),
    request = require('supertest'),
    express = require('express'),
    rewire = require('rewire'),
    config = require('app/config'),
    User = require('./user'),
    jwt = require('jwt-simple');
    
var router = rewire('./router');

var testUser = new User ({
  _id: mongoose.Types.ObjectId(),
  email: 'test@vogo.vogo',
  name: 'Test Vogo'
});

var mockRequireToken = function (req, res, next) {
  var token = req.headers['x-access-token'];
  if (token !== 'testToken') { 
    return res.status(401).end();
  }
  req.user = testUser;
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
  return request(app);
};

describe('User Router', function () {
  
  var app = createApp();
  
  describe('POST /login', function () {
    
    var path = '/login';
    
    it('should send 400 when no grantType field is provided', function (done) {
      var resbody = {
        status: 400,
        message: 'grantType field is missing or not valid'
      };
      app.post(path).send({}).expect(400, resbody, done);
    });
    
    describe('with password', function () {
      var user;
      
      beforeEach(function (done) {
        var data = {
          email: 'test@vogo.com',
          password: 'testpwd'
        };
        User.create(data, function (err, newUser) {
          if (err) { return done(err); } 
          user = newUser;
          done();
        });
      });
      
      it('should send 200 with user object', function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        app.post(path).send(reqBody).expect(200, function(err, res) {
          if (err) { return done(err); }
          expect(res.body.user.email).to.equal('test@vogo.com');
          done();
        });
      });
      
      it('should send 200 with access_token', function (done) {
        
        sinon.stub(Date, 'now').returns(1417876057391);
        
        var ACCESS_TOKEN = jwt.encode({
          iss: user.id,
          exp: Date.now() + config.jwtexp
        }, config.jwtsecret);
        
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        
        app.post(path).send(reqBody).expect(200, function(err, res) {
          Date.now.restore();
          if (err) { return done(err); }
          expect(res.body).to.have.deep.property('access_token', ACCESS_TOKEN);
          expect(res.body.user).to.not.have.property('followers');
          done();
        });
      });
      
      it('should send 401 when email is missing', function (done) {
        var reqBody = {
          grantType: 'password',
          password: 'testpwd'
        };
        var resBody = {
          status: 401,
          message: 'Invalid credentials'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });
      
      it('should send 401 when password is missing', function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password'
        };
        var resBody = {
          status: 401,
          message: 'Invalid credentials'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when password is wrong', function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'wrongpwd'
        };
        var resBody = {
          status: 401,
          message: 'Password is not correct'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when user does not exist', function (done) {
        var reqBody = {
          email: 'nonexistinguser@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        var resBody = {
          status: 401,
          message: 'Can\'t find a user with that email'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });
    });
    
    describe('with facebook access token', function () {
      
      var revert, mockRequest, mockPUploader, user;
      
      beforeEach(function (done) {
        var userData = {
          email: 'test@vogo.com',
          name: 'Test Vogo',
          picture: 'ppic',
          _updated: true,
          facebook: {
            id: 'fbtestid123',
            name: 'Test Vogo'
          }
        };
        User.create(userData, function (err, newUser) {
          if (err) { return done(err); } 
          user = newUser;
          done(); 
        });
      });
      
      beforeEach(function () {
        mockRequest = sinon.stub();
        mockPUploader = sinon.stub();
        revert = router.__set__({
          request: mockRequest,
          pUploader: mockPUploader
        });
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{ "id": "fbtestid123", "email": "test@vogo.com", "name": "Test Vogo"}'
        ]));
      });
      
      afterEach(function () {
        revert();
      });

      it('should send 400 when facebook token is missing', function (done) {
        var reqBody = { grantType: 'facebook' };
        var resBody = { 
          status: 400, 
          message: 'A facebook access token is required'
        };
        app.post(path).send(reqBody).expect(400, resBody, done);
      });

      it('should send request to facebook to get profile', function (done) {
        var reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, function (err, res) {
          if (err) { return done(err); } 
          expect(mockRequest).to.have.been
            .calledWith('https://graph.facebook.com/v2.3/me?fields=id,email,name,picture.type(large)&access_token=fakefbtk');
          done();
        });
      });

      it('should send 500 when it fails to get profile from facebook',
        function (done) {
        mockRequest.returns(Promise.resolve([{ statusCode: 400 },'{}']));
        var reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        var resBody = {
          name: 'FacebookGraphAPIError',
          message: "Failed to fetch facebook user profile",
          status: 500 
        }; 
        app.post(path).send(reqBody).expect(500, resBody, done);
      });
      
      it('should send 200 with user object', function (done) {
        var reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, function(err, res) {
          if (err) { return done(err); }
          expect(res.body.user.id).to.equal(user.id);
          expect(res.body.user.email).to.equal('test@vogo.com');
          done();
        });
      });
      
      it('should send 200 with access_token', function (done) {
        sinon.stub(Date, 'now').returns(1417876057391);
        var ACCESS_TOKEN = jwt.encode({
          iss: user.id,
          exp: Date.now() + config.jwtexp
        }, config.jwtsecret);
        var reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, function(err, res) {
          Date.now.restore();
          if (err) { return done(err); }
          expect(res.body).to.have.deep.property('access_token', ACCESS_TOKEN);
          expect(res.body.user).to.not.have.property('followers');
          done();
        });
      });

      it('should send 201 with a newly created user when there\'s no user with given fb id',
        function (done) {
        var reqBody = {grantType: 'facebook', facebookAccessToken: 'anotherfakefbtk'};
        // predefine result for facebook profile request
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{' + 
        '   "id": "newFbId12345",' +
        '   "email": "sam@home.net",' + 
        '   "name": "Sam Power",' +
        '   "picture": {"data": { "url": "profileUrl" } }' + 
        '}'
        ]));
        mockPUploader.withArgs('profileUrl')
          .returns(Promise.resolve('s3ProfileUrl'));
        
        app.post(path).send(reqBody).expect(200, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body).to.have.property('access_token').that.is.an('string');
          expect(res.body.user).to.have.property('name', 'Sam Power');
          expect(res.body.user).to.have.property('email', 'sam@home.net');
          expect(res.body.user).to.have.property('picture', 's3ProfileUrl');
          expect(res.body.user.facebook).to.have.property('id', 'newFbId12345');
          expect(res.body.user.facebook).to.have.property('email', 'sam@home.net');
          expect(res.body.user.facebook).to.have.property('name', 'Sam Power');
          done();
        });  
      });

      it('should send 200 and update profile picture of existing user',
        function (done) {
        var existingUser = {
          email: 'test2@vogo.com',
          name: 'Test Vogo2',
          picture: 'previousProfilePic',
          facebook: {
            id: 'fbtestidpicturetest',
            name: 'Test Vogo2'
          }
        };
        User.create(existingUser, function (err, user) {
          if (err) { return done(err); } 

          var reqBody = {grantType: 'facebook', facebookAccessToken: 'anotherfakefbtk'};

          mockRequest.returns(Promise.resolve([{
            statusCode: 200
          },
          '{' + 
          '   "id": "fbtestidpicturetest",' +
          '   "email": "test2@vogo.com",' + 
          '   "name": "Test Vogo2",' +
          '   "picture": {"data": { "url": "previousProfilePic" } }' + 
          '}'
          ]));
          mockPUploader.withArgs('previousProfilePic')
            .returns(Promise.resolve('s3ProfileUrl'));
          
          app.post(path).send(reqBody).expect(200, function (err, res) {
            if (err) { return done(err); } 
            expect(res.body).to.have.property('access_token').that.is.an('string');
            expect(res.body.user).to.have.property('name', 'Test Vogo2');
            expect(res.body.user).to.have.property('email', 'test2@vogo.com');
            expect(res.body.user).to.have.property('picture', 's3ProfileUrl');
            expect(res.body.user.facebook).to.have.property('id', 'fbtestidpicturetest');
            expect(res.body.user.facebook).to.have.property('name', 'Test Vogo2');
            done();
          });  
        });
      });
    });
  });

  describe('POST /deviceTokens', function () {
    
    var path = '/deviceTokens';
    
    it('should send 201', function (done) {
      sinon.stub(User, 'registerDeviceToken')
        .returns(Promise.resolve('returned token'));
      app.post(path)
        .set('x-access-token', 'testToken')
        .send({ token: 'testiosdevicetoken', os: 'ios' })
        .expect(201, function (err, res) {
          if (err) { return done (err); }
          expect(res.body).to.equal('returned token');
          expect(User.registerDeviceToken).to.have.been
            .calledWith(testUser.id, 'testiosdevicetoken', 'ios'); 
          User.registerDeviceToken.restore();
          done();
        });
    });
  });

  describe('POST /users', function () {
    
    var path = '/users';
    
    it('should send 201 with user data', function (done) {
      app.post(path)
        .send({ email: 'testuser@vogo.com' })
        .expect(201, function (err, res) {
          if (err) { return done (err); }
          expect(res.body).to.have.property('email', 'testuser@vogo.com');
          done();
        });
    });
  });

  describe('GET /users', function () {

    var path = '/users';
    
    beforeEach(function (done) {
      var users = [{email: 'bob@vogo.vogo'}, {email: 'sam@vogo.vogo'}];
      app.post(path).send(users[0]).expect(201, function () {
        app.post(path).send(users[1]).expect(201, done);
      });
    });

    it('should return 401 without an accessToken', function (done) {
      app.get(path).expect(401, done); 
    });

    it('should retreive array of users', function (done) {
      app.get(path)
        .set('x-access-token', 'testToken')
        .expect(200, function (err, res) {
          if (err) { return done(err); }
          expect(res.body).to.be.an('array');
          expect(JSON.stringify(res.body)).to.match(/bob@vogo.vogo/);
          expect(JSON.stringify(res.body)).to.match(/sam@vogo.vogo/);
          done();
        });
    });

  });

  describe('GET /users/{userId}', function () {

    var path = '/users';
    
    it('should retreive a specific user with id', function (done) {
      var userId;
      app.post(path)
        .send({ email: 'bob@vogo.vogo' })
        .expect(201, function(err, res) {
          if (err) { return done(err); }
          userId = res.body.id;
          app.get(path + '/' + userId)
            .set('x-access-token', 'testToken')
            .expect(200, function (err, res) {
              if (err) { return done(err); }
              expect(res.body).to.have.property('email', 'bob@vogo.vogo');
              done();
            });
        });
    });
  });

  describe('PUT /users/{userId}/follwoing/{target}', function () {

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id +
        '/following/507f1f77bcf86cd799439012';
      app.put(path).expect(401, done);
    });

    it('should send 403 if current user is not authorized', function (done) {
      var OTHER_USER_ID = mongoose.Types.ObjectId(),
          TARGET_ID = mongoose.Types.ObjectId(),
          path = '/users/' + OTHER_USER_ID + '/following/' + TARGET_ID;
      app.put(path).set('x-access-token', 'testToken').expect(403, done);
    });

    it('should send 200 with success', function (done) {
      sinon.stub(User, 'follow').returns(Promise.resolve({}));
      var targetUser = new User({
        _id: mongoose.Types.ObjectId(),
        email: 'target@address.com',
        name: 'Target User'
      });
      var path = '/users/' + testUser.id + '/following/' + targetUser.id;
      app.put(path).set('x-access-token', 'testToken')
        .expect(204, function (err) {
          if (err) { return done(err); }
          expect(User.follow).to.have.been.calledWith(testUser, targetUser.id);
          User.follow.restore();
          done();
        });
    });
  });

  describe('DELETE /users/{userId}/follwoing/{target}', function () {

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id +
        '/following/507f1f77bcf86cd799439012';
      app.del(path).expect(401, done);
    });

    it('should send 403 if current user is not authorized', function (done) {
      var OTHER_USER_ID = mongoose.Types.ObjectId(),
          TARGET_ID = mongoose.Types.ObjectId(),
          path = '/users/' + OTHER_USER_ID + '/following/' + TARGET_ID;
      app.del(path).set('x-access-token', 'testToken').expect(403, done);
    });

    it('should send 200 with success', function (done) {
      sinon.stub(User, 'unfollow').returns(Promise.resolve({}));
      var targetUser = new User({
        _id: mongoose.Types.ObjectId(),
        email: 'target@address.com',
        name: 'Target User'
      });
      var path = '/users/' + testUser.id + '/following/' + targetUser.id;
      app.del(path).set('x-access-token', 'testToken')
        .expect(204, function (err) {
          if (err) { return done(err); }
          expect(User.unfollow).to.have.been
            .calledWith(testUser, targetUser.id);
          User.unfollow.restore();
          done();
        });
    });

  });

  describe('GET /users/{userId}/followers', function () {

    beforeEach(function () { sinon.stub(User, 'getFollowers'); });
    afterEach(function () { User.getFollowers.restore(); });

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id + '/followers';
      app.get(path).expect(401, done);
    });

    it('should send 200 with list of followers', function (done) {
      var path = '/users/' + testUser.id + '/followers';
      User.getFollowers
        .withArgs(testUser.id, { skip: 0, limit: 100 })
        .returns(Promise.resolve([{ name: 'follower' }]));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, [{ name: 'follower' }], done);
    });

    it('should 200 with pagination parameters', function (done) {
      var path = '/users/' + testUser.id + '/followers';
      User.getFollowers
        .withArgs(testUser.id, { skip: 2, limit: 10 })
        .returns(Promise.resolve([{ name: 'follower' }]));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({skip: 2, limit: 10})
        .expect(200, [{ name: 'follower' }], done);
    });
  });

  describe('GET /users/{userId}/followers-count', function () {

    beforeEach(function () { sinon.stub(User, 'getFollowerCount'); });
    afterEach(function () { User.getFollowerCount.restore(); });

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id + '/followers-count';
      app.get(path).expect(401, done);
    });

    it('should send 200 with followers count', function (done) {
      var path = '/users/' + testUser.id + '/followers-count';
      User.getFollowerCount
        .withArgs(testUser.id)
        .returns(Promise.resolve(3));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, { numberOfFollowers: 3 }, done);
    });

  });

  describe('GET /users/{userId}/following', function () {

    beforeEach(function () { sinon.stub(User, 'getFollowing'); });
    afterEach(function () { User.getFollowing.restore(); });

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id + '/following';
      app.get(path).expect(401, done);
    });

    it('should send 200 with list of following users', function (done) {
      var path = '/users/' + testUser.id + '/following';
      User.getFollowing
        .withArgs(testUser.id, { skip: 0, limit: 100 })
        .returns(Promise.resolve([{ name: 'user' }]));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, [{ name: 'user' }], done);
    });

    it('should 200 with pagination parameters', function (done) {
      var path = '/users/' + testUser.id + '/following';
      User.getFollowing
        .withArgs(testUser.id, { skip: 2, limit: 10 })
        .returns(Promise.resolve([{ name: 'user' }]));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({skip: 2, limit: 10})
        .expect(200, [{ name: 'user' }], done);
    });

  });

  describe('GET /users/{userId}/following-count', function () {

    beforeEach(function () { sinon.stub(User, 'getFollowingCount'); });
    afterEach(function () { User.getFollowingCount.restore(); });

    it('should require an access_token', function (done) {
      var path = '/users/' + testUser.id + '/following-count';
      app.get(path).expect(401, done);
    });

    it('should send 200 with following count', function (done) {
      var path = '/users/' + testUser.id + '/following-count';
      User.getFollowingCount
        .withArgs(testUser.id)
        .returns(Promise.resolve(2));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, { numberOfFollowing: 2 }, done);
    });

  });

  describe('GET /relationships/follwoing', function () {

    beforeEach(function () { sinon.stub(User, 'getFollowingInfo'); });
    afterEach(function () { User.getFollowingInfo.restore(); });

    it('should require an access_token', function (done) {
      var path = '/relationships/following';
      app.get(path).expect(401, done);
    });

    it('should send 200', function (done) {
      var path = '/relationships/following',
          uid = mongoose.Types.ObjectId().toString();
      User.getFollowingInfo
        .withArgs(testUser.id, [uid])
        .returns(Promise.resolve({result: 'result'}));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({ userId: uid })
        .expect(200, { result: 'result' }, done);
    });

    it('should send 200 with array value userId parameter', function (done) {
      var path = '/relationships/following',
          uid1 = mongoose.Types.ObjectId().toString(),
          uid2 = mongoose.Types.ObjectId().toString();
      User.getFollowingInfo
        .withArgs(testUser.id, [uid1, uid2])
        .returns(Promise.resolve({result: 'result'}));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({ userId: [uid1, uid2] })
        .expect(200, { result: 'result' }, done);
    });

    it('should send if userId parameter is missing', function (done) {
        var resBody = { 
          status: 400, 
          message: 'userId parameter is required'
        };
        var path = '/relationships/following',
            uid = mongoose.Types.ObjectId().toString();
        User.getFollowingInfo
          .withArgs(testUser.id, [uid])
          .returns(Promise.resolve({result: 'result'}));
        app.get(path)
          .set('x-access-token', 'testToken')
          .expect(400, resBody, done);
    });

  });
});