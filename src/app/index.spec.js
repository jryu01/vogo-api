/* eslint no-unused-expressions: 0 */
import proxyquire from 'proxyquire';

describe('App', () => {
  let initApp;
  let app;

  it('should initialize', () => {
    initApp = proxyquire('./', {});
    app = initApp();
    expect(app).to.be.ok;
  });

  it('should use jsonParser middleware', () => {
    initApp = proxyquire('./', {});
    app = initApp();
    expect(app._router.stack[2].name).to.equal('jsonParser');
  });

  it('should use methodOverride middleware', () => {
    initApp = proxyquire('./', {});
    app = initApp();
    expect(app._router.stack[3].name).to.equal('methodOverride');
  });

  it('should use morgan logger middleware', () => {
    const morganStub = sinon.stub().returns(function logger() {});
    initApp = proxyquire('./', {
      'morgan': morganStub
    });
    app = initApp();

    expect(app._router.stack[4].name).to.equal('logger');
    expect(morganStub).to.have.been.calledWith('dev');
  });

  it('should use morgan logger middleware in non-dev env', () => {
    const morganStub = sinon.stub().returns(function loggerCombined() {});
    initApp = proxyquire('./', {
      './config': { env: 'test' },
      'morgan': morganStub
    });
    app = initApp();

    expect(app._router.stack[4].name).to.equal('loggerCombined');
    expect(morganStub).to.have.been.calledWith('combined');
  });

  it('should not log when status code < 400 in non-dev env', () => {
    const morganStub = sinon.stub().returns(function loggerCombined() {});
    initApp = proxyquire('./', {
      './config': { env: 'production' },
      'morgan': morganStub
    });
    app = initApp();
    const skip = morganStub.args[0][1].skip;
    expect(skip(null, { statusCode: 399 })).to.be.true;
  });

  it('should use cors middleware', () => {
    const corsStub = sinon.stub().returns(function cors() {});
    initApp = proxyquire('./', { 'cors': corsStub });
    app = initApp();
    expect(app._router.stack[5].name).to.equal('cors');
  });

  it('should use user router', () => {
    const userRouter = sinon.stub().returns(function userRouter() {});
    initApp = proxyquire('./', { './user/router': userRouter });
    app = initApp();
    expect(app._router.stack[6].regexp.test('/api')).to.be.true;
    expect(app._router.stack[6].name).to.equal('userRouter');
  });

  it('should use poll router', () => {
    const pollRouter = sinon.stub().returns(function pollRouter() {});
    initApp = proxyquire('./', { './poll/router': pollRouter });
    app = initApp();
    expect(app._router.stack[7].regexp.test('/api')).to.be.true;
    expect(app._router.stack[7].name).to.equal('pollRouter');
  });

  it('should use bing router', () => {
    const bingRouter = sinon.stub().returns(function bingRouter() {});
    initApp = proxyquire('./', { './bing/router': bingRouter });
    app = initApp();
    expect(app._router.stack[8].regexp.test('/api')).to.be.true;
    expect(app._router.stack[8].name).to.equal('bingRouter');
  });

  it('should use notification router', () => {
    const notification = sinon.stub()
      .returns(function notification() {});
    initApp = proxyquire('./', {
      './notification': notification
    });
    app = initApp();
    expect(app._router.stack[9].regexp.test('/api')).to.be.true;
    expect(app._router.stack[9].name).to.equal('notification');
  });
});
