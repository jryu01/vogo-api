'use strict';
/*jshint expr: true*/

var _ = require('lodash'),
    bcrypt = require('bcrypt'),
    mongoose = require('mongoose'),
    testUtil = require('../../test/testUtil');

var dataFactory = {
  create: function (overwrites) {
    var defaults = {
      email: 'Jhon@jhonhome.com',
      name: 'Jhon Bob',
      password: 'testPassword',
      facebook: {
        id: '12345'
      }
    };
    return _.extend(defaults, overwrites);
  }
};

describe('User', function () {

  var User, data;

  beforeEach(function () {
    User = require('app/user/user');
  });

  it('should create a new user', function () {
    data = dataFactory.create();
    return expect(User.createAsync(data)).to.be.fulfilled.then(function (user){
      expect(user).to.have.property('email', 'jhon@jhonhome.com');
      expect(user).to.have.property('password');
      expect(user).to.have.property('name', 'Jhon Bob');
      expect(user).to.have.property('followers').that.is.an('array');
      expect(user).to.have.deep.property('facebook.id', '12345');
    });
  });

  it('should give an error when email is missing', function () {
    data = dataFactory.create({ email: null });
    return expect(User.createAsync(data)).to.be.rejected.then(function (e) {
      expect(e).to.match(/email is required!/);
    });
  });

  it('should not save duplicate email', function () {
    data = dataFactory.create();
    var createUserPromise = User.createAsync(data).then(function (user) {
      return User.createAsync(data);
    });
    return expect(createUserPromise).to.be.rejected.then(function (e) {
      expect(e).to.match(/E11000 duplicate key error index/);
    });
  });

  it('should save hashed password on creation', function () {
    data = dataFactory.create();
    return expect(User.createAsync(data)).to.eventually.have
            .property('password', 'ASFEW24JKSFtestPasswordD12fj#jkdf10');
  });

  it('should not hash password if password is not modified', function () {
    data = dataFactory.create();
    sinon.spy(bcrypt, 'genSaltAsync');
    var promise = User.createAsync(data).then(function (user) {
      user.firstName = 'bob'; 
      return user.saveAsync();
    });
    return expect(promise).to.be.fulfilled.then(function () {
      expect(bcrypt.genSaltAsync).to.have.been.calledOnce;
      bcrypt.genSaltAsync.restore();
    });
  });
  describe('(user graph)', function () {

    var users, targetUser;

    beforeEach(function () {
      users = [];
      for (var i = 1; i <= 3; i += 1) {
        users.push(new User({
          _id: mongoose.Types.ObjectId(),
          email: 'from' + i + '@address.com',
          name: 'From User' + i,
          picture: 'profilePic' + i
        }));
      }
      targetUser = new User({
        _id: mongoose.Types.ObjectId(),
        email: 'target@address.com',
        name: 'Target User',
        picture: 'profilePicT'
      });
      users.push(targetUser);

      return User.createAsync(users);
    });

    it('should follow target user', function () {
      var promise = User.follow(users[0], targetUser._id).then(function () {
        return User.getFollowers(targetUser.id);
      });
      return expect(promise).to.be.fulfilled.then(function (followers) {
        expect(followers[0]).to.have.property('name', 'From User1');
        expect(followers[0]).to.have.property('picture', 'profilePic1');
        expect(followers[0].userId.toString()).to.equal(users[0].id);
        expect(followers[0]._id).to.be.undefined;
      });
    });

    it('should not follow same user twice', function () {
      var promise = User.follow(users[1], targetUser._id).then(function () {
        return User.follow(users[1], targetUser.id);
      }).then(function () {
        return User.getFollowers(targetUser.id);
      });
      return expect(promise).to.eventually.be.length(1);
    });

    it('should unfollow a user', function () {
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.unfollow(users[0], targetUser.id);
      }).then(function () {
        return User.getFollowers(targetUser.id);
      });
      return expect(promise).to.eventually.be.length(0);
    });

    it('should limit and skip list of followers on getFollowers', function () {
      var options = { skip: 1 , limit: 1 };
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[1], targetUser.id);
      }).then(function () {
        return User.follow(users[2], targetUser.id);
      }).then(function () {
        return User.getFollowers(targetUser.id, options);
      });
      return expect(promise).to.be.fulfilled.then(function (result) {
        expect(result).to.be.length(1);
        expect(result[0].name).to.equal(users[1].name);
      });
    });

    it('should retrive number of followers for a user', function () {
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[1], targetUser.id);
      }).then(function () {
        return User.getFollowerCount(targetUser.id);
      });
      return expect(promise).to.eventually.equal(2);
    });

    it('should return 0 on getFollowersCount on non-exist user', function () {
      var promise = User.getFollowerCount(mongoose.Types.ObjectId());
      return expect(promise).to.eventually.equal(0);
    });

    it('should get following users list of the user', function () {
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.getFollowing(users[0].id);
      });
      return expect(promise).to.be.fulfilled.then(function (following) {
        expect(following[0]).to.have.property('name', 'Target User');
        expect(following[0]).to.have.property('picture', 'profilePicT');
        expect(following[0].userId.toString()).to.equal(targetUser.id);
      });
    });

    it('should skip list of following users on getFollowing', function () {
      var options = { skip: 2 };
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[0], users[1].id);
      }).then(function () {
        return User.follow(users[0], users[2].id);
      }).then(function () {
        return User.getFollowing(users[0].id, options);
      });
      return expect(promise).to.eventually.be.length(1);
    });

    it('should limit list of following users on getFollowing', function () {
      var options = { skip: 1, limit: 1 };
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[0], users[1].id);
      }).then(function () {
        return User.follow(users[0], users[2].id);
      }).then(function () {
        return User.getFollowing(users[0].id, options);
      });
      return expect(promise).to.eventually.be.length(1);
    });

    it('should retrive number of following for a user', function () {
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[0], users[1].id);
      }).then(function () {
        return User.getFollowingCount(users[0].id);
      });
      return expect(promise).to.eventually.equal(2);
    });

    it('should retrive following relationships (one to one)', function () {
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.getFollowingInfo(users[0].id, [targetUser.id]);
      });
      return expect(promise).to.be.fulfilled.then(function (followingInfo) {
        expect(followingInfo[0]).to.have.property('name', 'Target User');
        expect(followingInfo[0]).to.have.property('userId', targetUser.id.toString());
        expect(followingInfo[0]).to.have.property('picture', targetUser.picture);
        expect(followingInfo[0]).to.have.property('following', true);
      });
    });

    it('should retrive following relationships (one to many)', function () {
      var targetUserIds = [targetUser.id, users[1].id, users[2].id];
      var promise = User.follow(users[0], targetUser.id).then(function () {
        return User.follow(users[1], targetUser.id);
      }).then(function () {
        return User.follow(users[0], users[2].id);
      }).then(function () {
        return User.getFollowingInfo(users[0].id, targetUserIds);
      });
      return expect(promise).to.be.fulfilled.then(function (fInfo) {
        expect(fInfo).to.be.length(3);
        fInfo.forEach(function (info) {
          if (info.userId.toString() === targetUser.id.toString()) {
            expect(info).to.have.property('following', true);

          } else if (info.userId.toString() === users[1].id.toString()) {
            expect(info).to.have.property('following', false);

          } else if (info.userId.toString() === users[2].id.toString()) {
            expect(info).to.have.property('following', true);
          }
        });
      });
      
    });
  });

  describe('#comparePassword', function () {

    it('should check for matching password', function () {
      data = dataFactory.create({ password: "matchingPwd" });

      var isMatching = User.createAsync(data).then(function (user) {
        return user.comparePassword('matchingPwd');
      });
      return expect(isMatching).to.eventually.be.true;
    });

    it('should check for wrong password', function () {
      data = dataFactory.create({ password: "matchingPwd" });
      var isMatching = User.createAsync(data).then(function (user) {
        return user.comparePassword('wrong');
      });
      return expect(isMatching).to.eventually.be.false;
    });
  });

  describe('#toJSON', function () {
    it('should return clean json', function () {
      data = dataFactory.create();
      var user = new User(data);
      expect(user.toJSON()).to.have.property('id');
      expect(user.toJSON()).to.not.have.property('_id');
      expect(user.toJSON()).to.not.have.property('__V');
      expect(user.toJSON()).to.not.have.property('password');
    });
  });
});