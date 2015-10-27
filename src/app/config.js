/**
 * configuration file
 *
 */
import _ from 'lodash';

const config = (env => {
  const conf = {};

  // Common configuration
  conf.common = {
    app: {
      name: 'voteit-api'
    },
    port: process.env.PORT || 3000,
    mongo: {},
    jwtsecret: 'jwtrandom secret for this beautiful app',
    jwtexp: 60 * 24 * 60 * 60 * 1000,
    bing: {
      accountKey: process.env.BING_ACC_KEY
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY
    },
    apns: {
      cert: 'vogoPushDevCert.pem',
      key: 'vogoPushDevKey.pem'
    }
  };

  // Development configuration
  conf.development = {
    env: 'development',
    mongo: {
      url: process.env.MONGO_URI || 'mongodb://localhost/voteit-api-dev'
    },
    aws: {
      bucket: 'dev.vogo',
      accessKey: 'AKIAJWUMKZKKVXADS3DA',
      secretKey: process.env.AWS_SECRET_KEY
    }
  };

  // Test (staging) configuration
  conf.test = {
    env: 'test',
    port: process.env.PORT || 3030,
    mongo: {
      url: process.env.MONGOLAB_URI
    },
    aws: {
      bucket: 'dev.vogo',
      accessKey: 'AKIAJWUMKZKKVXADS3DA',
      secretKey: process.env.AWS_SECRET_KEY
    }
  };

  // Production configuration
  conf.production = {
    env: 'production',
    mongo: {
      url: process.env.MONGOLAB_URI,
    },
    jwtsecret: 'jwtrandom prod secret for this beautiful app',
    aws: {
      bucket: 'app.vogo',
      accessKey: 'AKIAJWUMKZKKVXADS3DA',
      secretKey: process.env.AWS_SECRET_KEY
    },
    apns: {
      cert: 'vogoPushCert.pem',
      key: 'vogoPushKey.pem'
    }
  };

  return _.merge(conf.common, conf[env]);
})(process.env.NODE_ENV || 'development');

export default config;
