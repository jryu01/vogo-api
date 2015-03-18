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

// setup

// db connection
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

// setup mocks 
before(function () {
  //use mockBcrypt for entire testing because hashing is too expensive
  useMock(bcrypt, mockBcrypt);
});

// cleanup db
beforeEach(function (done) {
  // clear database
  for (var i in mongoose.connection.collections) {
    mongoose.connection.collections[i].remove(function () {});
  } 
  return done();
});

// teardown

// afterEach();
after(function () {
  bcrypt.restoreOriginal();
});