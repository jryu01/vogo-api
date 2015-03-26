'use strict';
/*jshint expr: true*/
var methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    Promise = require('bluebird'),
    request = require('supertest'),
    express = require('express'),
    rewire = require('rewire'),
    config = require('app/config'),
    User = require('./user'),
    jwt = require('jwt-simple');
    
var router = rewire('./router');

var createApp = function () {
  var app = express(); 
  app.use(bodyParser.json());
  app.use(methodOverride());
  app.use('/api', router());
  app = request(app);
  return app;
};

describe('User Router', function () {
  
  var app = createApp();
  
  describe('POST /users/signin', function () {
    
    var path = '/api/users/signin';
    
    it('should send 400 when no grantType field is provided', function (done) {
      var resBody = {
        status: 400,
        message: 'grantType field is missing or not valid'
      };
      app.post(path).send({}).expect(400, resBody, done);
    });
    
    describe('with password', function () {
      var user;
      
      beforeEach(function (done) {
        var data = {
          email: 'test@vogo.com',
          password: 'testpwd'
        }
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
      
      var revert, mockRequest, user;
      
      beforeEach(function (done) {
        var userData = {
          email: 'test@vogo.com',
          name: 'Test Vogo',
          facebook: {
            id: 'fbtestid123',
            name: 'Test Vogo'
          }
        }
        User.create(userData, function (err, newUser) {
          if (err) { return done(err); } 
          user = newUser;
          done(); 
        });
      });
      
      beforeEach(function () {
        mockRequest = sinon.stub();
        revert = router.__set__({
          request: mockRequest
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
            .calledWith('https://graph.facebook.com/me?field=id,email,name&access_token=fakefbtk');
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
        '{ "id": "newFbId12345", "email": "sam@home.net", "name": "Sam Power"}'
        ]));
        
        app.post(path).send(reqBody).expect(200, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body).to.have.property('access_token').that.is.an('string')
          expect(res.body.user).to.have.property('name', 'Sam Power');
          expect(res.body.user).to.have.property('email', 'sam@home.net');
          expect(res.body.user.facebook).to.have.property('id', 'newFbId12345');
          expect(res.body.user.facebook).to.have.property('email', 'sam@home.net');
          expect(res.body.user.facebook).to.have.property('name', 'Sam Power');
          done();
        });  
      });
    });
  });

  describe('POST /api/users', function () {
    
    var path = '/api/users';
    
    it('should send 201 with user data', function (done) {
      app.post(path)
        .send({ email: 'testUser@vogo.com' })
        .expect(201, function (err, res) {
          if (err) { return done (err); }
          expect(res.body).to.have.property('email', 'testUser@vogo.com');
          done();
        });
    });

  });

  describe('GET /api/users', function () {

    var path = '/api/users';
    
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
      var revert =  router.__set__({
        requiresToken: function (req, res, next) { next(); }
      });
      var localApp = createApp();
      localApp.get(path).expect(200, function (err, res) {
        if (err) { return done(err); }
        expect(res.body).to.be.an('array');
        expect(JSON.stringify(res.body)).to.match(/bob@vogo.vogo/);
        expect(JSON.stringify(res.body)).to.match(/sam@vogo.vogo/);
        revert();
        done();
      });
    });

  });

  describe('GET /api/users/{userId}', function () {

    var path = '/api/users';
    
    it('should retreive a specific user with id', function (done) {
      var userId;
      app.post(path)
        .send({ email: 'bob@vogo.vogo' })
        .expect(201, function(err, res) {
          if (err) { return done(err); }
          userId = res.body.id;
          app.get(path + '/' + userId).expect(200, function (err, res) {
            if (err) { return done(err); }
            expect(res.body).to.have.property('email', 'bob@vogo.vogo');
            done();
          });
        });
    });
  });

});