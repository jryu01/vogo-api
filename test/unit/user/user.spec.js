'use strict';
/*jshint expr: true*/

require('../../dbSetup');

var _ = require('lodash'),
    chai = require('chai'),
    sinon = require('sinon'),
    testUtil = require('../../testUtil'),
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require("chai-as-promised"),
    expect = chai.expect;

chai.use(sinonChai);
chai.use(chaiAsPromised);

var dataFactory = {
  create: function (overwrites) {
    var defaults = {
      email: 'jhon@jhonhome.com',
      name: 'Jhon Bob',
      password: 'testPassword',
      facebook: {
        id: '12345'
      }
    };
    return _.extend(defaults, overwrites);
  }
};

describe('User', function () {

  var User, data, bcrypt;

  beforeEach(function () {
    bcrypt = require('bcrypt');
    testUtil.useMockBcrypt();
    User = require('app/user/user');
  });

  afterEach(function () {
    testUtil.restoreBcrypt();
  });

  it('should create a new user', function () {
    data = dataFactory.create();
    return expect(User.createAsync(data)).to.be.fulfilled.then(function (user){
      expect(user).to.have.property('email', 'jhon@jhonhome.com');
      expect(user).to.have.property('password');
      expect(user).to.have.property('name', 'Jhon Bob');
      expect(user).to.have.deep.property('facebook.id', '12345');
    });
  });

  it('should give an error when email is missing', function () {
    data = dataFactory.create({ email: null });
    return expect(User.createAsync(data)).to.be.rejected.then(function (e) {
      expect(e).to.match(/email is required!/);
    });
  });

  it('should not save duplicate email', function () {
    data = dataFactory.create();
    var createUserPromise = User.createAsync(data).then(function (user) {
      return User.createAsync(data);
    });
    return expect(createUserPromise).to.be.rejected.then(function (e) {
      expect(e).to.match(/E11000 duplicate key error index/);
    });
  });

  it('should save hashed password on creation', function () {
    data = dataFactory.create();
    return expect(User.createAsync(data)).to.eventually.have
            .property('password', 'ASFEW24JKSFtestPasswordD12fj#jkdf10');
  });

  it('should not hash password if password is not modified', function () {
    data = dataFactory.create();
    var promise = User.createAsync(data).then(function (user) {
      user.firstName = 'bob'; 
      return user.saveAsync();
    });
    return expect(promise).to.be.fulfilled.then(function () {
      expect(bcrypt.genSaltAsync).to.have.been.calledOnce;
    });
  });

  describe('#comparePassword', function () {

    it('should check for matching password', function () {
      data = dataFactory.create({ password: "matchingPwd" });

      var isMatching = User.createAsync(data).then(function (user) {
        return user.comparePassword('matchingPwd');
      });
      return expect(isMatching).to.eventually.be.true;
    });

    it('should check for wrong password', function () {
      data = dataFactory.create({ password: "matchingPwd" });
      var isMatching = User.createAsync(data).then(function (user) {
        return user.comparePassword('wrong');
      });
      return expect(isMatching).to.eventually.be.false;
    });
  });

  describe('#toJSON', function () {
    it('should return clean json', function () {
      data = dataFactory.create();
      var user = new User(data);
      expect(user.toJSON()).to.have.property('id');
      expect(user.toJSON()).to.not.have.property('_id');
      expect(user.toJSON()).to.not.have.property('__V');
      expect(user.toJSON()).to.not.have.property('password');
    });
  });
});