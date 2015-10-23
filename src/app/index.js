import methodOverride from 'method-override';
import bodyParser from 'body-parser';
import express from 'express';
import morgan from 'morgan';
import config from './config';
import cors from 'cors';

import userRouter from './user/router';
import pollRouter from './poll/router';
import bingRouter from './bing/router';
import notification from './notification';

const logger = env =>
  env === 'development'
    ? morgan('dev')
    : morgan('combined', { skip: (req, res) => res.statusCode < 400 });

const createApp = () => {
  const app = express();

  app.use(bodyParser.json());
  app.use(methodOverride());
  app.use(logger(config.env));
  app.use(cors());

  // Mount express sub app/routers
  app.use('/api', userRouter());
  app.use('/api', pollRouter());
  app.use('/api', bingRouter());
  app.use('/api', notification());

  return app;
};

export default createApp;
