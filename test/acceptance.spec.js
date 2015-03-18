'use strict';
/*jshint expr: true*/

require('./dbSetup');

var testUtil = require('./testUtil');
var request = require('supertest');
var expect = require('chai').expect;
var _ = require('lodash');

var dataFactory = { 
  create: function (overwrites) {
    var defaults = { 
      email: 'example@example.com', 
      password: 'testPassword',
      access_token: ''
    };
    return _.extend(defaults, overwrites);
  }
};

describe('All Routes', function () {
  var app;

  beforeEach(function () {
    app = require('app');
  });

  it('should respond with header with valid CORS settings', function (done) {
    request(app).get('/anything')
    .expect('Access-Control-Allow-Origin', '*')
    .expect('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    .expect('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token', done);
  });

  it('should respond with 200 with OPTIONS request', function (done) {
    request(app).options('/anything')
    .expect(200, done);
  });
});

describe('Auth Routes', function () {

  var app, user, data;

  before(function () {
    testUtil.useMockBcrypt();
  });
  after(function () {
    testUtil.restoreBcrypt();
  });

  beforeEach(function (done) {
    app = require('app');
    data = {
      email: 'jhon@handsome.com',
      firstName: 'Jhon', 
      lastName: 'Power', 
      grantType: 'password',
      password: 'test password'
    };
    testUtil.createUser(data, function (err, u) {
      if (err) { return done(err); }
      user = u;
      done();
    });
  });
  
  describe('POST /login', function () {

    it('should respond with access_token and loged in user on success', 
      function (done) {
      request(app).post('/login').send(data)
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function (err, res) {
        expect(res.body.user).to.have.property('email', 'jhon@handsome.com');
        expect(res.body).to.have.property('access_token');
        expect(res.body.access_token).to.have.length.above(10);
        done();
      });
    });

    // it('should respond with aws s3 signed policy with signiture on success', 
    //   function (done) {
    //   request(app).post('/login').send(data)
    //   .expect(200)
    //   .end(function (err, res) {
    //     expect(res.body).to.have.property('aws');
    //     expect(res.body.aws).to.have.property('s3Policy');
    //     expect(res.body.aws).to.have.property('s3Signiture');
    //     done();
    //   });
    // });

    it('should respond 401 error with invalid credentials', function (done) {
      data.password = '';    
      request(app).post('/login').send(data)
      .expect('Content-Type', /json/)
      .expect(401)
      .expect(/Invalid credentials/, done);
    });

    it('should respond 401 error with wrong password', function (done) {
      data.password = 'wrong';    
      request(app).post('/login').send(data)
      .expect('Content-Type', /json/)
      .expect(401)
      .expect(/Password is not correct/, done);
    });

    it('should respond 401 error when user doesn\'t exist', function (done) {
      data.email = 'wrong@email.com';    
      request(app).post('/login').send(data)
      .expect('Content-Type', /json/)
      .expect(401)
      .expect(/Can't find a user with that email/, done);
    });

    it('should respond with 400 when no grantType field is provided', 
      function (done) {
      delete data.grantType;
      request(app).post('/login').send(data)
      .expect(400, done);
    });

    it('should respond with 400 with invalid grantType', 
      function (done) {
      data.grantType = 'invalid grantType';
      request(app).post('/login').send(data)
      .expect(400, done);
    });
  });
});

describe('Secured Routes', function () { 

  var app, securedUrl;

  before(function () {
    testUtil.useMockBcrypt();
  });
  after(function () {
    testUtil.restoreBcrypt();
  });

  beforeEach(function () {
    app = require('app');
    securedUrl = '/api/users';
  });

  it('should requires valid access_token', function (done) {
    request(app).get(securedUrl)
    .expect(401)
    .expect(/Access token is missing!/, done);
  });

  it('should requires non-expired access_token', function (done) {
    var day = 1000*60*60*24;
    testUtil.createUserAndGetAccessToken({ expire: -day }, function (err, tk) {
      if (err) { return done(err); }
      request(app).get(securedUrl).query({ access_token: tk})
      .expect(401)
      .expect(/Access token has been expired/, done);
    });
  });

  it('should requires valid access_token for existing user', function (done) {
    testUtil.createUserAndGetAccessToken({}, function (err, tk) {
      if (err) { return done(err); }
      testUtil.clearDB();
      request(app).get(securedUrl).query({ access_token: tk })
      .expect(401)
      .expect(/User not found with the token/, done);
    });
  });

  describe('without token', function () {
    it('should respond 401 on GET /api/users', function (done) {
      request(app).get('/api/users').expect(401, done);
    });

    // it('should respond 401 on POST /api/activities', function (done) {
    //   request(app).post('/api/activities').send({})
    //   .expect(401, done);
    // });
  });
});

// ----------------COVERED in V2------------

// describe('User Routes', function () {

//   var app, User, data, token;

//   before(function () {
//     testUtil.useMockBcrypt();
//   });
//   after(function () {
//     testUtil.restoreBcrypt();
//   });

//   beforeEach(function () {
//     app = require('app');
//     User = require('app/user/user.js');
//   });

//   beforeEach(function (done) {
//     testUtil.createUserAndGetAccessToken({}, function (err, tk) {
//       if (err) { return done(err); }
//       token = tk;
//       done();
//     });
//   });

//   describe('POST /api/users', function () {

//     beforeEach(function () {
//       data = dataFactory.create({ access_token: token });
//     });

//     it('should save a user to db and return it', function (done) {
//       request(app).post('/api/users').send(data)
//       .expect('Content-Type', /json/)
//       .expect(200)
//       .end(function (err, res) {
//         if (err) { done(err); }
//         expect(res.body).to.have.property('id');
//         expect(res.body).to.have.property('email', 'example@example.com');
//         expect(res.body).to.not.have.property('password');
//         User.findById(res.body.id, function (err, user) {
//           expect(user).to.have.property('id');
//           expect(user).to.have.property('email', 'example@example.com');
//           expect(user).to.have.property('password');
//           done();
//         });
//       });
//     });

//     it('should respond with 400 error when required field is missing', 
//       function (done) {
//       delete data.email;
//       request(app).post('/api/users').send(data)
//       .expect('Content-Type', /json/)
//       .expect(400)
//       .expect(/email is required!/, done);
//     });

//     it('should respond with 400 error when email already exists', function (done) {
//       request(app).post('/api/users').send(data)
//       .expect(200, function (err, res) {
//         request(app).post('/api/users').send(data)
//         .expect(400)
//         .expect(/The email already exists in the system/, done);
//       });
//     });

//   });

//   describe('GET /api/users', function () {

//     beforeEach(function (done) {
//       var user1 = dataFactory.create({email: 'bob@home.io'});
//       var user2 = dataFactory.create({email: 'sam@home.io'});
//       testUtil.createUser([user1, user2], function (err, user) {
//         if (err) { return done(err); }
//         done();
//       });
//     });

//     it('should retreive array of users', function (done) {
//       request(app).get('/api/users')
//         .set('X-Access-Token', token)
//         .expect('Content-Type', /json/)
//         .expect(200)
//         .end(function (err, res) {
//           if (err) { return done(err); }
//           expect(res.body).to.be.an('array');
//           expect(JSON.stringify(res.body)).to.match(/bob@home.io/);
//           expect(JSON.stringify(res.body)).to.match(/sam@home.io/);
//           done();
//         });
//     });

//   });
  
//   describe('GET /api/users/{userId}', function () {
//     it('should retreive a specific user with id', function (done) {
//       User.findOne(function (err, user) {
//         request(app).get('/api/users/' + user.id)
//           .set('X-Access-Token', token)
//           .expect('Content-Type', /json/)
//           .expect(200)
//           .end(function (err, res) {
//             if (err) { done(err); }
//             expect(res.body).to.have.property('id', user.id);
//             done();
//           });
//       });
//     });
//   });

// });

describe('Poll Routes', function () {

 //  var app, Activity, data, token, user;

 //  before(function () {
 //    testUtil.useMockBcrypt();
 //  });
 //  after(function () {
 //    testUtil.restoreBcrypt();
 //  });

 //  beforeEach(function () {
 //    app = require('app');
 //    Activity = require('app/poll/poll.js');
 //  });

 //  beforeEach(function (done) {
 //    testUtil.createUserAndGetAccessToken({}, function (err, tk, u) {
 //      if (err) { return done(err); }
 //      token = tk;
 //      user = u;
 //      done();
 //    });
 //  });

 //  describe('POST /api/activities', function () {

 //    it('should create an activity and respond with it', function (done) {
 //      data = {
 //        name: 'Bball Tournament'
 //      };
 //      request(app).post('/api/activities').send(data)
 //      .set('X-Access-Token', token)
 //      .expect('Content-Type', /json/)
 //      .expect(200)
 //      .end(function (err, res) {
 //        if (err) { done(err); }
 //        expect(res.body).to.have.property('id');
 //        expect(res.body).to.have.property('name', 'Bball Tournament');
 //        Activity.findById(res.body.id, function (err, activity) {
 //          expect(activity).to.have.property('id');
 //          done();
 //        });
 //      });
 //    });

 //    it('should save activity with organizer.id set as current user id', 
 //      function (done) {
 //      request(app).post('/api/activities')
 //      .send({ 
 //        name: 'Bball Tournament', 
 //        organizer: {id: 'accidently put wrong id'}
 //      })
 //      .set('X-Access-Token', token)
 //      .expect('Content-Type', /json/)
 //      .expect(200)
 //      .end(function (err, res) {
 //        if (err) { done(err); }
 //        expect(res.body.organizer.id).to.equal(user.id);
 //        Activity.findById(res.body.id, function (err, activity) {
 //          expect(activity.organizer.id).to.equal(user.id);
 //          done();
 //        });
 //      });
 //    });

 //    it('should respond with 400 error when required fields are missing', 
 //      function (done) {
 //      delete data.name;
 //      request(app).post('/api/activities').send(data)
 //      .set('X-Access-Token', token)
 //      .expect('Content-Type', /json/)
 //      .expect(400, done);
 //    });

 //  });

 //  describe('GET /api/activities', function () {

 //    beforeEach(function (done) {
 //      var activities = [];
 //      //generate random data
 //      for (var i = 0; i < 20; i++) {
 //        activities.push({
 //          name: 'random activity ' + i,
 //          startTime: new Date('2014/02/'+(Math.floor(Math.random() * 28) + 1)),
 //          updatedTime: new Date('2013/10/' + (i + 1)) // increasing order
 //        });
 //      }
 //      // first 11 records
 //      activities[10].startTime = new Date('2014/01/01'); //1
 //      activities[11].startTime = new Date('2014/01/02'); //2
 //      activities[9].startTime = new Date('2014/01/03'); //3
 //      activities[8].startTime = new Date('2014/01/04'); //4
 //      activities[7].startTime = new Date('2014/01/05'); //5
 //      activities[4].startTime = new Date('2014/01/06'); //6
 //      activities[6].startTime = new Date('2014/01/07'); //7
 //      activities[5].startTime = new Date('2014/01/08'); //8
 //      activities[3].startTime = new Date('2014/01/09'); //9
 //      //same date
 //      activities[2].startTime = new Date('2014/01/10'); //10
 //      activities[2].updatedTime = new Date('2013/10/12');
 //      activities[0].startTime = new Date('2014/01/10'); //11
 //      activities[0].updatedTime = new Date('2013/10/11');
 //      activities[1].startTime = new Date('2014/01/10'); //13
 //      activities[1].updatedTime = new Date('2013/10/l0');
 //      Activity.create(activities, function (err, result) {
 //        if (err) { return done(err); }
 //        done();
 //      });
 //    });

 //    it('should retreive an array of 10 activities', function (done) {
 //      request(app).get('/api/activities')
 //        .expect('Content-Type', /json/)
 //        .expect(200)
 //        .end(function (err, res) {
 //          if (err) { return done(err); }
 //          expect(res.body).to.be.an('array');
 //          expect(res.body).to.have.length(10);
 //          expect(JSON.stringify(res.body)).to.match(/random activity/);
 //          done();
 //        });
 //    });

 //    it('should retreive activities sorted on startTime in increasing order',
 //      function (done) {
 //      request(app).get('/api/activities')
 //        .expect('Content-Type', /json/)
 //        .end(function (err, res) {
 //          if (err) { return done(err); }
 //          for (var i = 1; i < res.body.length; i++) {
 //            expect(res.body[i].startTime)
 //            .to.be.at.least(res.body[i-1].startTime);
 //          }
 //          done();
 //        });
 //    });

 //    it('should retreive activities with same startTime sorted on updatedTime' +
 //       ' in decresing order (latest updated activity first)', function (done) {
 //      request(app).get('/api/activities')
 //        .expect('Content-Type', /json/)
 //        .end(function (err, res) {
 //          if (err) { return done(err); }
 //          for (var i = 1; i < res.body.length; i++) {
 //            if (res.body[i -1].startTime === res.body[i].startTime) {
 //              expect(res.body[i - 1].updatedTime)
 //              .to.be.above(res.body[i].updatedTime);
 //            }
 //          }
 //          done();
 //        });
 //    });

 //    it('should retrive 10 activities with startTime later than or equal to provided startTime sorted on startTime and updatedTime', function (done) {
 //      // startTime and updatedTime of 10th item
 //      var startTime = new Date('2014/01/10');
 //      var updatedTime = new Date('2013/10/12');
 //      request(app)
 //        .get('/api/activities?lastItemStartTime=' + startTime + 
 //            '&lastItemUpdatedTime=' + updatedTime)
 //        .expect('Content-Type', /json/)
 //        .end(function (err, res) {
 //          if (err) { return done(err); }
 //          for (var i = 1; i < res.body.length; i++) {
 //            expect(res.body[i].startTime)
 //            .to.be.at.least(startTime.toISOString());

 //            expect(res.body[i].startTime)
 //            .to.be.at.least(res.body[i-1].startTime);

 //            if (res.body[i -1].startTime === res.body[i].startTime) {
 //              expect(res.body[i - 1].updatedTime)
 //              .to.be.above(res.body[i].updatedTime);
 //            }
 //          }
 //          done();
 //        });
 //    });

 //  });
 
 // describe('GET /api/activities/{activityId}', function () {
 //    it('should retreive a specific activity with id', function (done) {
 //      Activity.create({ name: "Activity One" },function (err, activity) {
 //        request(app).get('/api/activities/' + activity.id)
 //          .expect('Content-Type', /json/)
 //          .expect(200)
 //          .end(function (err, res) {
 //            if (err) { done(err); }
 //            expect(res.body).to.have.property('id', activity.id);
 //            done();
 //          });
 //      });
 //    });
 // });

});