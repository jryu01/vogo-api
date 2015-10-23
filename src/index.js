import mongoose from 'mongoose';
import config from './app/config';
import initApp from './app';

const app = initApp();

app.set('port', config.port);

// connect db
mongoose.connect(config.mongo.url);

// start listening for requests
app.listen(app.get('port'), () =>
  console.log(
    `${config.app.name} listening on port ${config.port} for ${config.env}`
  ));
