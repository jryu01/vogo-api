'use strict';
/*jshint expr: true*/

var request = require('supertest');
var app = request(require('app'));

describe('User Router', function () {

  describe('POST /api/users', function () {

    it('should send 201 with user data', function (done) {
      app.post('/api/v2/users')
        .send({ email: 'testUser@vogo.com' })
        .expect(201, function (err, res) {
          if (err) { return done (err); }
          expect(res.body).to.have.property('email', 'testUser@vogo.com');
          done();
        });
    });
    
  });

  describe('GET /api/users', function () {

    beforeEach(function (done) {
      var users = [{email: 'bob@vogo.vogo'}, {email: 'sam@vogo.vogo'}];
      app.post('/api/v2/users').send(users[0]).expect(201, function () {
        app.post('/api/v2/users').send(users[1]).expect(201, done);
      });
    });

    it('should retreive array of users', function (done) {
      app.get('/api/v2/users').expect(200, function (err, res) {
        if (err) { return done(err); }
        expect(res.body).to.be.an('array');
        expect(JSON.stringify(res.body)).to.match(/bob@vogo.vogo/);
        expect(JSON.stringify(res.body)).to.match(/sam@vogo.vogo/);
        done();
      });
    });

  });

  describe('GET /api/users/{userId}', function () {

    it('should retreive a specific user with id', function (done) {
      var userId;
      app.post('/api/v2/users')
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