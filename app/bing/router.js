'use strict';
var config = require('app/config'),
    express = require('express'),
    Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    requireToken = require('app/middleware/requireToken');


var searchImage = function (req, res, next) {
  var query = req.query.query || '',
      opts = {};

  opts.skip = 0;
  opts.userAgent = 'Vogo Api';
  opts.accKey = config.bing.accountKey;
  opts.reqTimeout = 5000;

  var reqUrl = 'https://api.datamarket.azure.com/Bing/Search/v1/Image?' +
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
    var response = result[0],
        body = result[1];
    if (response && response.statusCode !== 200) {
      throw new Error('Bing Api Error: ' + body);
    }
    body = typeof body === 'string' ? JSON.parse(body) : body;
    res.json(body);
  }).catch(next);
};

var userRouter = module.exports = function () {
  var router = express.Router();

  router.get('/bing/search/image', requireToken, searchImage);

  return router;
};
