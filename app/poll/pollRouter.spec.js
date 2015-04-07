'use strict';
/*jshint expr: true*/
var methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    Promise = require('bluebird'),
    request = require('supertest'),
    express = require('express'),
    rewire = require('rewire');
    
var router = rewire('./pollRouter');

var mockRequireToken = function (req, res, next) {
  var token = req.headers['x-access-token'];
  if (token !== 'testToken') { 
    return res.status(401).end();
  }
  req.user = {
    id: '507f1f77bcf86cd799439011',
    emai: 'test@vogo.vogo',
    name: 'Test Vogo'
  };
  next();
};

var createApp = function () {
  var app = express(); 
  app.use(bodyParser.json());
  app.use(methodOverride());
  router.__set__({
    requireToken: mockRequireToken   
  });
  app.use('/api', router());
  app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.json(err);
  });
  return app;
};


describe('Poll Router', function () {
  
  var app = createApp();
  
  describe('POST /api/polls', function () {
    
    var path = '/api/polls';
    
    it('should send 201 with created poll data', function (done) {
      var reqBody = {
        subject1: { text: 'left answer' },
        subject2: { text: 'right answer' }
      };
      request(app).post(path)
        .set('x-access-token', 'testToken')
        .send(reqBody)
        .expect(201, function (err, res) {
          if (err) { return done(err); } 
          expect(res.body.createdBy).to.have.property('name', 'Test Vogo');
          done();
        });
    });
       
  });

});