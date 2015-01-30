'use strict';
/*jshint expr: true*/
var Promise = require('bluebird'),
    rewire = require('rewire'),
    _ = require('lodash'),
    chai = require('chai'),
    sinon = require('sinon'),
    expect = chai.expect,
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require("chai-as-promised");
chai.use(sinonChai);
chai.use(chaiAsPromised);


var reqFactory = {
  create: function (overwrites) {
    var defaults = {
      body: {
        name: 'Jhon',
        email: 'jhon@jhonhome.com'
      },
      params: {},
      query: {},
    };
    return _.extend(defaults, overwrites);
  }
};

describe('userController', function () {

  var controller, req, res, User;

  beforeEach(function () {
    User = { 
      create: sinon.stub(), 
      createAsync: sinon.stub(), 
      find: sinon.stub(),
      findAsync: sinon.stub(),
      findById: sinon.stub(),
      findByIdAsync: sinon.stub()
    };
    req = reqFactory.create(); 
    res = {};

    controller = rewire('../../../lib/user/userController');
    controller.__set__({
      User: User
    });
  });

  describe('#post', function () {

    beforeEach( function () {
      User.createAsync.returns(Promise.resolve('default'));
    });

    it('should return a promise', function () {
      expect(controller.post(req, res)).to.be.an('object'); 
      expect(controller.post(req, res).then).to.be.a('function'); 
    });

    it('should create a user and reolve result', function () {
      User
        .createAsync
        .withArgs(req.body)
        .returns(Promise.resolve({name: 'Jhon', email: 'jhon@jhonhome.com'}));

      return expect(controller.post(req, res))
              .to.eventually
              .deep.equal({name: 'Jhon', email: 'jhon@jhonhome.com'});
    });

  });

  describe('#list', function () {

    beforeEach( function () {
      User.findAsync.returns(Promise.resolve('default'));
    });

    it('should return a promise', function () {
      expect(controller.list(req, res)).to.be.an('object'); 
      expect(controller.list(req, res).then).to.be.a('function'); 
    });

    it('should find a list of users and reolve it', function () {
      User
        .findAsync
        .withArgs({})
        .returns(Promise.resolve([{name: 'Jhon'}]));

      return expect(controller.list(req, res))
              .to.eventually
              .deep.equal([{name: 'Jhon'}]);
    });
    
  });

  describe('#get', function () {

    beforeEach( function () {
      User.findByIdAsync.returns(Promise.resolve('default'));
    });

    it('should return a promise', function () {
      expect(controller.get(req, res)).to.be.an('object'); 
      expect(controller.get(req, res).then).to.be.a('function'); 
    });

    it('should find a user and reolve it', function () {
      User
        .findByIdAsync
        .withArgs('123abcd')
        .returns(Promise.resolve({name: 'Jhon'}));
      req.params.id = '123abcd';
      return expect(controller.get(req, res))
              .to.eventually
              .deep.equal({name: 'Jhon'});
    });
    
  });

});