'use strict';

var Promise = require('bluebird'),
    mongoose = Promise.promisifyAll(require('mongoose')),
    bcrypt = Promise.promisifyAll(require('bcrypt')),
    config = require('app/config'),
    Poll = require('app/poll/poll'),
    eb = require('app/eventBus'),
    Schema = mongoose.Schema;

var FollowerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId },
  picture: String,
  name: String,
});

var DeviceTokenSchema = new Schema({
  token: String,
  os: String
});

var UserSchema = new Schema({
  email: { 
    type: String, 
    required: '{PATH} is required!', 
    unique: true, 
    lowercase: true 
  },
  name: String,
  password: String,
  picture: String,
  facebook: {
    id: String,
    email: String,
    name: String,
    picture: String
  },
  followers: { type: [ FollowerSchema ] },

  _updated: Boolean,

  deviceTokens: [ DeviceTokenSchema ],
});

UserSchema.index({'deviceTokens.token': 1});
UserSchema.index({'followers.userId': 1});

UserSchema.pre('save', function (next) { 
  var user = this,
      saltWorkFactor = (config.env === 'production') ? 10 : 1;
      
  if (!user.isModified('password')) { return next(); }

  bcrypt.hashAsync(user.password, saltWorkFactor).then(function (hash) {
    user.password = hash;
    next();
  });
});

// User Graph functions 

UserSchema.statics.follow = function (fromUser, toUserId) {
  var query = {
    _id: toUserId,
    'followers.userId': { $ne: fromUser.id }
  };
  var update = {
    '$push': {
      'followers': {
        userId: fromUser.id,
        picture: fromUser.picture,
        name: fromUser.name
      }
    }
  };
  return this.findOneAndUpdateAsync(query, update).then(function () {
    setImmediate(function () {
      eb.emit('userModel:follow', { userId: fromUser.id, toUserId: toUserId });
    });
  });
};

UserSchema.statics.unfollow = function (fromUser, toUserId) {
  var update = {
    '$pull': {
      'followers': {
        userId: fromUser.id
      }
    }
  };
  return this.findByIdAndUpdateAsync(toUserId, update);
};

UserSchema.statics.getFollowers = function (userId, options) {
  options = options || {};
  options.skip = options.skip || 0;
  options.limit = options.limit || 100;
  var project = { 
    'followers': { $slice: [options.skip, options.limit] },
    'followers._id': 0, 
  };
  return this.findByIdAsync(userId, project).then(function (result) {
    return result ? result.followers : [];
  });
};

UserSchema.statics.getFollowerCount = function (userId) {
  return this.aggregateAsync([
    { $match: { "_id": mongoose.Types.ObjectId(userId) } },
    { $project: { numFollowers: { $size: '$followers' } } }
  ]).then(function (result) {
    return result[0] ? result[0].numFollowers : 0;
  });
};

UserSchema.statics.getFollowing = function (userId, options) {
  options = options || {};
  options.skip = options.skip || 0;
  options.limit = options.limit || 100;
  return this.aggregateAsync([
    { $match: { 'followers.userId': mongoose.Types.ObjectId(userId) } },
    { $skip: options.skip }, 
    { $limit: options.limit },
    { $project: { name: 1, userId: '$_id', _id: 0, picture: 1 } }
  ]);
};

UserSchema.statics.getFollowingCount = function (userId) {
  var query = this.find({ 'followers.userId': userId });
  return query.countAsync();
};
// Return the relationships of the source user to the target users. 
UserSchema.statics.getFollowingInfo = function (userId, targetUserIds) {
  var query = {
    '_id': { '$in': targetUserIds }
  };
  var projection = {
    'name': 1,
    'picture': 1,
    'followers': { '$elemMatch': {'userId': userId }}
  };
  return this.findAsync(query, projection).then(function (users) {
    return users.map(function (user) {
      var o = {
        userId: user.id, 
        name: user.name,
        picture: user.picture,
        following: user.followers.length > 0
      };
      return o;
    });
  });
};

////////////

// this needs test
var updateUserData = function (userModel, user) {
  var setUpdatedToFalse = function () {
    userModel.updateAsync({ _id: userId }, {'$set': {'_updated': false}});
  };

  var userId = user.id;
  var options = { multi: true };
  // update the user in poll collection
  Poll.updateAsync(
    { 'createdBy.userId': userId }, 
    { '$set': {'createdBy.picture': user.picture} }, 
    options
  ).then(setUpdatedToFalse)
  .catch(setUpdatedToFalse);

  // update the user in followers lists 
  userModel.updateAsync(
    { 'followers.userId': userId }, 
    { '$set': {'followers.$.picture': user.picture} }, 
    options
  ).catch(setUpdatedToFalse);

  Poll.find({'comments.createdBy.userId': userId}).stream()
    .on('data', function (poll) {
      poll.comments.forEach(function (comment) {
        if (!comment.createdBy) { return; }
        if (comment.createdBy.userId.equals(userId)) {
          comment.createdBy.picture = user.picture;
        }
      });
      poll.save();
    })
    .on('error', setUpdatedToFalse);
};

UserSchema.statics.createOrUpdate = function (userId, userData) {
  var that = this;
  return new Promise(function (resolve, reject) {
    that.findOneAndUpdate(
      { _id: userId },
      userData, 
      { 'new': true, upsert: true, 'passRawResult': true },
      function (err, user, raw) {
        if (err) { reject(err); }

        // TODO: Need Test ///////////
        var updatedExisting = raw && raw.lastErrorObject &&
            raw.lastErrorObject.updatedExisting;
        if (updatedExisting) {
          updateUserData(that, user);
        }
        //////////////////////////

        return resolve(user);
      }
    );

  });
};

UserSchema.statics.registerDeviceToken = function (userId, deviceToken, os) {
  var model = this;
  var query = { _id: userId, 'deviceTokens.token': { $ne: deviceToken } };
  var addToken = {
    '$push': {
      'deviceTokens': { token: deviceToken, os: os }
    }
  };

  var removeTokenFromPrevUser = this.updateAsync(
    { 'deviceTokens.token': deviceToken },
    {
      '$pull': {
        'deviceTokens': { token: deviceToken } 
      }
    },
    { multi: true }
  );

  return removeTokenFromPrevUser.then(function () {
    return model.findOneAndUpdateAsync(query, addToken).then(function () {
      return { userId: userId, token: deviceToken, os: os };
    });
  });
};

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