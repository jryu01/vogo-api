var mongoose = require('mongoose');
var config = require('app/config');
var app = require('app');

app.set('port', config.port);

// connect db
mongoose.connect(config.mongo.url);

// start listening for requests
app.listen(app.get('port'));
console.log(config.app.name + ' listening on port ' + config.port + ' for ' + config.env);