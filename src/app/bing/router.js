import config from '../config';
import express from 'express';
import Promise from 'bluebird';
import expressJwt from 'express-jwt';

const request = Promise.promisify(require('request'));

const searchImage = function (req, res, next) {
  const query = req.query.query || '';
  const opts = {};

  opts.skip = 0;
  opts.userAgent = 'Vogo Api';
  opts.accKey = config.bing.accountKey;
  opts.reqTimeout = 5000;

  const reqUrl = 'https://api.datamarket.azure.com/Bing/Search/v1/Image?' +
    'Query=%27' + query + '%27' +
    '&Adult=%27Strict%27' +
    '&ImageFilters=%27Size%3AMedium%2BAspect%3ASquare%27' +
    '&$format=json' +
    '&$skip=' + opts.skip;
  request({
    uri: reqUrl,
    method: 'GET',
    headers: {
      'User-Agent': opts.userAgent
    },
    auth: {
      user: opts.accKey,
      pass: opts.accKey
    },
    timeout: opts.reqTimeout
  }).then(function (result) {
    const response = result[0];
    let body = result[1];
    if (response && response.statusCode !== 200) {
      throw new Error('Bing Api Error: ' + body);
    }
    body = typeof body === 'string' ? JSON.parse(body) : body;
    res.json(body);
  }).catch(next);
};

export default () => {
  const router = express.Router();

  router.use(expressJwt({
    secret: config.jwtsecret,
    getToken: req => req.headers['x-access-token'] || null
  }));
  router.get('/bing/search/image', searchImage);

  return router;
};
