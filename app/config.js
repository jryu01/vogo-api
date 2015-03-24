/**
 * configuration file
 *
 */

'use strict';

var _ = require('lodash');

var config = (function (env) {
  var conf = {};

  // Common configuration
  conf.common =  {
    app: {
      name: "voteit-api"
    },
    port: process.env.PORT || 3000,
    mongo: {},
    jwtsecret: 'jwtrandom secret for this beautiful app',
    jwtexp: 60 * 24 * 60 * 60 * 1000,
    aws: {
      accessKey: 'AWS ACCESS KEY',
      secretKey: 'AWS SECRET KEY'
    }
  };

  // Development configuration
  conf.development = {
    env: "development",
    mongo: {
      url: "mongodb://localhost/voteit-api-dev"
    },
    aws: {
      bucket: 'AWS S3 BUCKET NAME'
    }
  };

  // Test configuration
  conf.test = {
    env: "test",
    port: process.env.PORT || 3030,
    mongo: {
      url: process.env.MONGOLAB_URI || "mongodb://localhost/voteit-api-test"
    },
    aws: {
      bucket: 'AWS S3 BUCKET NAME'
    }
  };

  // Production configuration
  conf.production = {
    env: "production",
    mongo: {
      url: process.env.MONGOLAB_URI,
    },
    aws: {
      bucket: 'AWS S3 BUCKET NAME'
    }
  };

  return _.merge(conf.common, conf[env]);

})(process.env.NODE_ENV || 'development');

module.exports = config;