'use strict';

var Promise = require('bluebird');
var sinon = require('sinon');
var mockBcrypt = require('./mockBcrypt');
var bcrypt = Promise.promisifyAll(require('bcrypt'));
var config = require('../app/config');
var jwt = require('jwt-simple');
var User = require('../app/user/user.js');
var mongoose = require('mongoose');


var testUtil = {
  createUserAndGetAccessToken: function (options, cb) {
    var data = {
      email: 'authtestuser@test.com',
      firstName: 'auth',
      lastName: 'testuser',
      password: 'testPassword' 
    };
    var expire = options.expire || (7*24*60*60*1000);
    User.create(data, function (err, user) {
      if (err) { return cb(err); }
      var token = jwt.encode({ 
        iss: user.id, 
        exp: Date.now() + expire
      }, config.jwtsecret);
      cb(null, token, user);
    });
  },
  createUser: function (data, cb) {
    User.create(data, function (err, user) {
      if (err) { return cb(err); }
      cb(null, user);
    });
  },
  clearDB: function () {
    var cb = function () {};
     for (var i in mongoose.connection.collections) {
       mongoose.connection.collections[i].remove(cb);
     }
  },
  restoreBcrypt: function () {
    bcrypt.genSalt.restore();
    bcrypt.genSaltAsync.restore();
    bcrypt.hash.restore();
    bcrypt.hashAsync.restore();
    bcrypt.compare.restore();
    bcrypt.compareAsync.restore();
  },
  useMockBcrypt: function () {
    sinon.stub(bcrypt, 'genSalt', mockBcrypt.genSalt);
    sinon.stub(bcrypt, 'genSaltAsync', mockBcrypt.genSaltAsync);
    sinon.stub(bcrypt, 'hash', mockBcrypt.hash);
    sinon.stub(bcrypt, 'hashAsync', mockBcrypt.hashAsync);
    sinon.stub(bcrypt, 'compare', mockBcrypt.compare);
    sinon.stub(bcrypt, 'compareAsync', mockBcrypt.compareAsync);
  }
};

module.exports = testUtil;