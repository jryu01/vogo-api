'use strict';
/*jshint expr: true*/
/*global -sinon*/

// ensure the NODE_ENV is set to 'test'
process.env.NODE_ENV = 'test';

var chai = require('chai'),
    sinon = require('sinon'),
    config = require('app/config'),
    mongoose = require('mongoose'),
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require("chai-as-promised");

chai.use(sinonChai);
chai.use(chaiAsPromised);

mongoose.models = {};
mongoose.modelSchemas = {};

// set globals 
global.sinon = sinon;
global.expect = chai.expect;

// setup
before(function (done) {
  // connect database
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.mongo.url, function (err) {
      if (err) {
        throw err;
      }
      return done();
    });
  } else {
    return done();
  }
});

beforeEach(function (done) {
  // clear database
  for (var i in mongoose.connection.collections) {
    mongoose.connection.collections[i].remove(function () {});
  } 
  return done();
});

// teardown
// afterEach();
// after();