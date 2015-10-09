'use strict';
/*jshint expr: true*/
/*global -sinon*/

// ensure the NODE_ENV is set to 'test'
process.env.NODE_ENV = 'test';

var _ = require('lodash'),
    chai = require('chai'),
    sinon = require('sinon'),
    config = require('app/config'),
    bcrypt = require('bcrypt'),
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

// mocks
var mockBcrypt = {
  genSalt: function (saltWorkFactor, cb){
    return cb(null, saltWorkFactor);
  },
  hash: function (pwd, salt, cb) {
    var fakeHash = 'ASFEW24JKSF' + pwd +'D12fj#jkdf' + salt;
    return cb(null, fakeHash);
  },
  compare: function (candidatePwd, pwd, cb) {
    var match = pwd.indexOf(candidatePwd) >= 0;
    return cb(null, match); 
  }
};

// Replace original module with provided mock object 
var useMock = function (originalModule, mock) {
  originalModule._originalProperties = _.clone(originalModule);
  originalModule._isMockedObj = true;

  _.assign(originalModule, mock);

  originalModule.restoreOriginal = function () {
    var original = this._originalProperties;
    _.assign(this, original);
    delete this._originalProperties;
    delete this._isMockedObj;
    delete this.restoreOriginal;
  };
};

var connectDb = function (callback) {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.mongo.url, function (err) {
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
  useMock(bcrypt, mockBcrypt);
  connectDb(done);
});

after(function (done) {
  bcrypt.restoreOriginal();
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