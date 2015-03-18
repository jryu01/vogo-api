'use strict';

var methodOverride = require('method-override');
var errorHandler = require('./errorHandler.js');
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
app.use('/', require('./router'));
app.use('/', require('app/user/router'));
app.use(errorHandler());

module.exports = app;