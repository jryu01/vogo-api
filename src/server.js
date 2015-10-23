import mongoose from 'mongoose';
import config from './app/config';
import createApp from './app';

// connect db
mongoose.connect(config.mongo.url);

const app = createApp();
// start listening for requests
app.listen(config.port, () =>
  console.log(
    `${config.app.name} listening on port ${config.port} for ${config.env}`
  ));
