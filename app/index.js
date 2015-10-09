  'use strict';

var methodOverride = require('method-override'),
    bodyParser = require('body-parser'),
    express = require('express'),
    morgan  = require('morgan'), // HTTP request logger
    config = require('./config'),
    app = express();

app.use(bodyParser.json());
app.use(methodOverride());

// set up logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: function (req, res) { return res.statusCode < 400; }
  }));
}

app.use('/', function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
  } else {
    next();
  }
});

// Mount express sub app/routers 
var errorHandler = require('app/middleware/errorHandler.js'),
    userRouter = require('app/user/router'),
    pollRouter = require('app/poll/router'),
    bingRouter = require('app/bing/router'),
    notification = require('app/notification');

app.use('/api', userRouter());
app.use('/api', pollRouter());
app.use('/api', bingRouter());
app.use('/api', notification());
app.use(errorHandler());

module.exports = app;