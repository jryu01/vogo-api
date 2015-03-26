'use strict';
/*jshint expr: true*/

var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var expect = chai.expect;
chai.use(sinonChai);

var errorHandler = require('./errorHandler');

describe('Middleware: errorHandler', function () {

  var eHandler = errorHandler();
  var err, req, res, next;

  beforeEach(function () {
    // test doubles
    err = {};
    req = {};
    res = { json: sinon.spy(), status: sinon.spy() };
    next = {}; 
  });

  it('should be a function', function () {
    expect(eHandler).to.be.a('function');
  });

  it('should respond with status 500', function () {
    eHandler(err, req, res, next);
    expect(res.status).to.have.been.calledOnce;
    expect(res.status).to.have.been.calledWith(500);
  });

  it('should respond with error message', function () {
    err = new Error('Unexpected server error'); 
    eHandler(err, req, res, next);
    expect(res.json).to.have.been.calledOnce;
    expect(res.json).to.have.been.calledWith({
      message: 'Unexpected server error'
    });
  });

  it('should respond with status with provided error status code', 
    function () {
    err = { status: 400, message: 'some error' };
    eHandler(err, req, res, next);
    expect(res.status).to.have.been.calledWith(400);
  });

  describe('with MongoError', function () {

    it('should respond with status 400 error when code is E11000', function () {
      err = { name: 'MongoError', code: 11000, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });

    it('should respond with status 400 error when code is E11001', function () {
      err = { name: 'MongoError', code: 11001, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });

    it('should respond with custom error message for duplicate email',
      function () {
      err = {
        name: 'MongoError',
        code: 11001,
        message: 'E11000 duplicate key error index: email'
      };
      eHandler(err, req, res, next);
      expect(res.json).to.have.been.calledWith({
        message: 'The email already exists in the system'
      });
    });

    it('should respond with status 500 for other errors', function () {
      err = { name: 'MongoError', code: 1234, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });

  });

  describe('with mongoose ValidationError', function () {
    beforeEach(function () {
      // mongoose error obj
      err = { 
        message: 'Validation failed',
        name: 'ValidationError',
        errors: {
          name: { 
            message: 'name is required!',
            name: 'ValidatorError',
            path: 'name',
            type: 'required',
            value: undefined 
          }
        }
      };

    });

    it('should respond with status 400', function () {
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
    });

    it('should respond with a error message', function () {
      eHandler(err, req, res, next);
      expect(res.json).to.have.been.calledWith({ message: 'name is required!'});
    });  

    it('should respond with a message containing error messages' +
      ' seperated by comma when there are multiple errors', function () {
      err.errors.email = {
        message: 'email is required!',
        name: 'ValidatorError',
        path: 'email',
        type: 'required',
        value: undefined 
      };
      eHandler(err, req, res, next);
      expect(res.json).to.have.been.calledWith({
        message:'name is required!,email is required!'
      });
    });

  });

});