/* eslint no-unused-expressions: 0 */
import proxyquire from 'proxyquire';

const initApp = (stub = {}) => {
  const createApp = proxyquire('./', stub);
  return createApp();
};

describe('App', () => {
  it('should initialize', () => {
    const app = initApp();
    expect(app).to.be.ok;
  });

  it('should use jsonParser middleware', () => {
    const app = initApp();
    expect(app._router.stack[2].name).to.equal('jsonParser');
  });

  it('should use methodOverride middleware', () => {
    const app = initApp();
    expect(app._router.stack[3].name).to.equal('methodOverride');
  });

  it('should use morgan logger middleware', () => {
    const morganStub = sinon.stub().returns(function logger() {});
    const app = initApp({
      'morgan': morganStub
    });

    expect(app._router.stack[4].name).to.equal('logger');
    expect(morganStub).to.have.been.calledWith('dev');
  });

  it('should use morgan logger middleware in non-dev env', () => {
    const morganStub = sinon.stub().returns(function loggerCombined() {});
    const app = initApp({
      './config': { env: 'test' },
      'morgan': morganStub
    });

    expect(app._router.stack[4].name).to.equal('loggerCombined');
    expect(morganStub).to.have.been.calledWith('combined');
  });

  it('should not log when status code < 400 in non-dev env', () => {
    const morganStub = sinon.stub().returns(function loggerCombined() {});
    initApp({
      './config': { env: 'production' },
      'morgan': morganStub
    });
    const skip = morganStub.args[0][1].skip;
    expect(skip(null, { statusCode: 399 })).to.be.true;
    expect(skip(null, { statusCode: 400 })).to.be.false;
  });

  it('should use cors middleware', () => {
    const corsStub = sinon.stub().returns(function cors() {});
    const app = initApp({ 'cors': corsStub });
    expect(app._router.stack[5].name).to.equal('cors');
  });

  it('should use user router', () => {
    const userRouter = sinon.stub().returns(function userRouter() {});
    const app = initApp({ './user/router': userRouter });
    expect(app._router.stack[6].regexp.test('/api')).to.be.true;
    expect(app._router.stack[6].name).to.equal('userRouter');
  });

  it('should use poll router', () => {
    const pollRouter = sinon.stub().returns(function pollRouter() {});
    const app = initApp({ './poll/router': pollRouter });
    expect(app._router.stack[7].regexp.test('/api')).to.be.true;
    expect(app._router.stack[7].name).to.equal('pollRouter');
  });

  it('should use bing router', () => {
    const bingRouter = sinon.stub().returns(function bingRouter() {});
    const app = initApp({ './bing/router': bingRouter });
    expect(app._router.stack[8].regexp.test('/api')).to.be.true;
    expect(app._router.stack[8].name).to.equal('bingRouter');
  });

  it('should use notification router', () => {
    const notification = sinon.stub()
      .returns(function notification() {});
    const app = initApp({
      './notification': notification
    });
    expect(app._router.stack[9].regexp.test('/api')).to.be.true;
    expect(app._router.stack[9].name).to.equal('notification');
  });
});
