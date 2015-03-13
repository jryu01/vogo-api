'use strict';

var Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require('mongoose')),
    bcrypt = Promise.promisifyAll(require('bcrypt')),
    SALT_WORK_FACTOR = 10,
    Schema = mongoose.Schema;

var UserSchema = new Schema({
  email: { type: String, required: '{PATH} is required!', unique: true },
  name: String,
  password: String,
  facebook: {
    id: String,
    name: String
  }
});

UserSchema.pre('save', function (next) { 
  var user = this;
  if (!user.isModified('password')) { return next(); }

  bcrypt.genSaltAsync(SALT_WORK_FACTOR).then(function (salt) {
    return bcrypt.hashAsync(user.password, salt);
  }).then(function (hash) {
    user.password = hash;
    next();
  });
});

UserSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compareAsync(candidatePassword, this.password);
};

//Add toJSON option to transform document before returnig the result
UserSchema.options.toJSON = {
  transform: function (doc, ret, options) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
  }
};
 
module.exports = mongoose.model('User', UserSchema);