'use strict';
/*jshint expr: true*/

var jwt = require('jwt-simple'),
    config = require('app/config'),
    request = require('supertest'),
    app = request(require('app'));

describe('User Router', function () {
  
  describe('POST /users/signin', function () {
    
    var path = '/api/v2/users/signin';
    
    it('should send 400 when no grantType field is provided', function (done) {
      var resBody = JSON.stringify({
        status: 400,
        message: 'grantType field is missing or not valid'
      });
      app.post(path).send({}).expect(400, resBody, done);
    });
    
    describe('with password', function () {
      var user;
      
      beforeEach(function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          password: 'testpwd'
        }
        app.post('/api/v2/users')
          .send(reqBody)
          .expect(201, function (err, res) {
            if (err) { return done(err); }
            user = res.body;
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
          if (err) { done(err); }
          expect(res.body.user.email).to.equal('test@vogo.com');
          done();
        });
      });
      
      it('should send with 200 with access_token', function (done) {
        
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
          if (err) { done(err); }
          expect(res.body).to.have.deep.property('access_token', ACCESS_TOKEN);
          done();
        });
      });
      
      it('should send 401 when email is missing', function (done) {
        var reqBody = {
          grantType: 'password',
          password: 'testpwd'
        };
        var resBody = JSON.stringify({
          status: 401,
          message: 'Invalid credentials'
        });
        app.post(path).send(reqBody).expect(401, resBody, done);
      });
      
      it('should send 401 when password is missing', function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password'
        };
        var resBody = JSON.stringify({
          status: 401,
          message: 'Invalid credentials'
        });
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when password is wrong', function (done) {
        var reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'wrongpwd'
        };
        var resBody = JSON.stringify({
          status: 401,
          message: 'Password is not correct'
        });
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when user does not exist', function (done) {
        var reqBody = {
          email: 'nonexistinguser@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        var resBody = JSON.stringify({
          status: 401,
          message: 'Can\'t find a user with that email'
        });
        app.post(path).send(reqBody).expect(401, resBody, done);
      });
    });
  });

  describe('POST /api/users', function () {
    
    var path = '/api/v2/users';
    
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

    var path = '/api/v2/users';
    
    beforeEach(function (done) {
      var users = [{email: 'bob@vogo.vogo'}, {email: 'sam@vogo.vogo'}];
      app.post(path).send(users[0]).expect(201, function () {
        app.post(path).send(users[1]).expect(201, done);
      });
    });

    it('should return 401 without an accessToken', function (done) {
      app.get(path).expect(401, done); 
    });

    it.skip('should retreive array of users', function (done) {
      app.get(path).expect(200, function (err, res) {
        if (err) { return done(err); }
        expect(res.body).to.be.an('array');
        expect(JSON.stringify(res.body)).to.match(/bob@vogo.vogo/);
        expect(JSON.stringify(res.body)).to.match(/sam@vogo.vogo/);
        done();
      });
    });

  });

  describe('GET /api/users/{userId}', function () {

    var path = '/api/v2/users';
    
    it('should retreive a specific user with id', function (done) {
      var userId;
      app.post(path)
        .send({ email: 'bob@vogo.vogo' })
        .expect(201, function(err, res) {
          if (err) { return done(err); }
          userId = res.body.id;
          app.get('/api/users/' + userId).expect(200, function (err, res) {
            if (err) { return done(err); }
            expect(res.body).to.have.property('email', 'bob@vogo.vogo');
            done();
          });
        });
    });
  });

});