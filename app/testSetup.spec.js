// ensure the MONGOLAB_URI is set to use test db
process.env.MONGO_URI = 'mongodb://localhost/voteit-api-test';

import chai from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';

const DB_URI = process.env.MONGO_URI;

chai.use(sinonChai);
chai.use(chaiAsPromised);

mongoose.models = {};
mongoose.modelSchemas = {};

// set globals
global.sinon = sinon;
global.expect = chai.expect;

const connectDb = callback => {
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(DB_URI, err => {
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
before(connectDb);
after(mongoose.disconnect.bind(mongoose));

// cleanup db
beforeEach(done => {
  // clear database
  Object.keys(mongoose.connection.collections)
    .forEach(name => mongoose.connection.collections[name].remove(() => {}));
  return done();
});
