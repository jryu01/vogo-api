'use strict';

var errorHanlder = module.exports = function () {
  return function (err, req, res, next) {
    // TODO: write test
    var e = err;
    if (err.name === 'OperationalError') {
      err = err.cause;
    }
    switch (err.name) {
      case 'ValidationError':
        var msgs = [];
        for (var error in err.errors) {
          msgs.push(err.errors[error].message);
        }
        res.status(400);
        res.json({ message: msgs.join() });
        break; 
      case 'MongoError':
        if (err.code === 11000 || err.code === 11001) {
          err.status = 400;
          if (err.message.indexOf('email') >= 0) {
            err.message = 'The email already exists in the system';
          }
        }
        res.status(err.status || 500);
        res.json({ message: err.message });
        break;
      default:
        // console.log(e);
        // console.log(e.stack);
        res.status(err.status || 500);
        res.json({ message: err.message });
    }
  };
};