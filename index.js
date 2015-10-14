//Note: This file should be es5
var mongoose = require('mongoose');

// use babel for subsequent require
require('babel-core/register');

var config = require('app/config');
var app = require('app');

app.set('port', config.port);

// connect db
mongoose.connect(config.mongo.url);

// start listening for requests
app.listen(app.get('port'));
console.log(config.app.name + ' listening on port ' + config.port + ' for ' + config.env);
