import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import errorHandler from './errorHandler';

describe('Middleware: errorHandler', () => {
  const eHandler = errorHandler();
  let err, req, res, next;

  beforeEach(() => {
    // test doubles
    err = {};
    req = {};
    res = { json: sinon.spy(), status: sinon.spy() };
    next = {};
  });

  it('should be a function', () => {
    expect(eHandler).to.be.a('function');
  });

  it('should respond with status 500', () => {
    eHandler(err, req, res, next);
    expect(res.status).to.have.been.calledOnce;
    expect(res.status).to.have.been.calledWith(500);
  });

  it('should respond with error message', () => {
    err = new Error('Unexpected server error');
    eHandler(err, req, res, next);
    expect(res.json).to.have.been.calledOnce;
    expect(res.json).to.have.been.calledWith({
      message: 'Unexpected server error'
    });
  });

  it('should respond with status with provided error status code',
    () => {
    err = { status: 400, message: 'some error' };
    eHandler(err, req, res, next);
    expect(res.status).to.have.been.calledWith(400);
  });

  describe('with MongoError', () => {
    it('should respond with status 400 error when code is E11000', () => {
      err = { name: 'MongoError', code: 11000, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });

    it('should respond with status 400 error when code is E11001', () => {
      err = { name: 'MongoError', code: 11001, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });

    it('should respond with custom error message for duplicate email',
      () => {
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

    it('should respond with status 500 for other errors', () => {
      err = { name: 'MongoError', code: 1234, message: 'some error'};
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(500);
      expect(res.json).to.have.been.calledWith({
        message: 'some error'
      });
    });
  });

  describe('with mongoose ValidationError', () => {
    beforeEach(() => {
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

    it('should respond with status 400', () => {
      eHandler(err, req, res, next);
      expect(res.status).to.have.been.calledWith(400);
    });

    it('should respond with a error message', () => {
      eHandler(err, req, res, next);
      expect(res.json).to.have.been.calledWith({ message: 'name is required!'});
    });

    it('should respond with a message containing error messages' +
      ' seperated by comma when there are multiple errors', () => {
      err.errors.email = {
        message: 'email is required!',
        name: 'ValidatorError',
        path: 'email',
        type: 'required',
        value: undefined
      };
      eHandler(err, req, res, next);
      expect(res.json).to.have.been.calledWith({
        message: 'name is required!,email is required!'
      });
    });
  });
});
