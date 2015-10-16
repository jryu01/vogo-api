import methodOverride from 'method-override';
import bodyParser from 'body-parser';
import express from 'express';
import morgan from 'morgan';
import config from './config';

import errorHandler from 'app/middleware/errorHandler.js';
import userRouter from 'app/user/router';
import pollRouter from 'app/poll/router';
import bingRouter from 'app/bing/router';
import notification from 'app/notification';

const app = express();

app.use(bodyParser.json());
app.use(methodOverride());

// set up logging
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip(req, res) { return res.statusCode < 400; }
  }));
}

app.use('/', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-type,Accept,X-Access-Token');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
  } else {
    next();
  }
});

// Mount express sub app/routers
app.use('/api', userRouter());
app.use('/api', pollRouter());
app.use('/api', bingRouter());
app.use('/api', notification());
app.use(errorHandler());

module.exports = app;
