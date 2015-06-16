'use strict';

var methodOverride = require('method-override');
var errorHandler = require('app/middleware/errorHandler.js');
var userRouter = require('app/user/userRouter');
var pollRouter = require('app/poll/pollRouter');
var bingRouter = require('app/bing/router');
var bodyParser = require('body-parser');
var express = require('express');
var logger  = require('morgan'); // HTTP request logger
var config = require('./config');
var app = express();

app.use(bodyParser.json());
app.use(methodOverride());
if (config.env === 'development') {
  app.use(logger('dev'));
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
app.use('/api', userRouter());
app.use('/api', pollRouter());
app.use('/api', bingRouter());
app.use(errorHandler());

module.exports = app;