'use strict';
/*jshint expr: true*/
/*global -sinon*/

// ensure the MONGOLAB_URI is set to use test db
process.env.MONGO_URI = 'mongodb://localhost/voteit-api-test';

var _ = require('lodash'),
    chai = require('chai'),
    sinon = require('sinon'),
    mongoose = require('mongoose'),
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require("chai-as-promised");

var DB_URI = process.env.MONGO_URI;

chai.use(sinonChai);
chai.use(chaiAsPromised);

mongoose.models = {};
mongoose.modelSchemas = {};

// set globals 
global.sinon = sinon;
global.expect = chai.expect;

var connectDb = function (callback) {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(DB_URI, function (err) {
      if (err) {
        throw err;
      }
      return callback();
    });
  } else {
    return callback();
  }
};

// global setup and teardown
before(function (done) {
  connectDb(done);
});

after(function (done) {
  mongoose.disconnect(done);
});

// cleanup db
beforeEach(function (done) {
  // clear database
  for (var i in mongoose.connection.collections) {
    mongoose.connection.collections[i].remove(function () {});
  } 
  return done();
});