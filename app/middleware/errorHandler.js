export default () =>
  (err, req, res) => {
    // TODO: write test
    let error = err;
    if (error.name === 'OperationalError') {
      error = error.cause;
    }
    switch (error.name) {
    case 'ValidationError':
      const msgs = [];
      Object.keys(error.errors).forEach(key => {
        msgs.push(error.errors[key].message);
      });
      res.status(400);
      res.json({ message: msgs.join() });
      break;
    case 'MongoError':
      if (error.code === 11000 || error.code === 11001) {
        error.status = 400;
        if (error.message.indexOf('email') >= 0) {
          error.message = 'The email already exists in the system';
        }
      }
      res.status(error.status || 500);
      res.json({ message: error.message });
      break;
    default:
      res.status(error.status || 500);
      res.json({ message: error.message });
    }
  };
