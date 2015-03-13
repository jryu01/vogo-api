'use strict';

var config = require('../app/config'),
    mongoose = require('mongoose');
    
mongoose.models = {};
mongoose.modelSchemas = {};

// ensure the NODE_ENV is set to 'test'
process.env.NODE_ENV = 'test';

beforeEach(function (done) {

  function clearDB() {
    var cb = function () {};
    for (var i in mongoose.connection.collections) {
      mongoose.connection.collections[i].remove(cb);
    }
    return done();
  }

  if (mongoose.connection.readyState === 0) {
    mongoose.connect(config.mongo.url, function (err) {
      if (err) {
        throw err;
      }
      return clearDB();
    });
  } else {
    return clearDB();
  }
});