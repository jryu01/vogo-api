/* eslint no-unused-expressions: 0 */
import _ from 'lodash';
import eb from '../eventBus';
import config from '../config';
import bcrypt from 'bcrypt';
import Promise from 'bluebird';
import mongoose from 'mongoose';
import User from '../user/user';

const userData = {
  create: overwrites => {
    const defaults = {
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

describe('User', () => {
  beforeEach(() => sinon.stub(eb, 'emit'));
  afterEach(() => eb.emit.restore());

  describe('.createOrUpdate', () => {
    it('should create a new user', () => {
      const user = new User({
        email: 'testuser@test.net',
        name: 'test user',
        facebook: {
          id: 'fbfakeid123',
          email: 'testUser@test.net',
          name: 'test user'
        }
      });
      return expect(User.createOrUpdate(user.id, user.toJSON())).to.be.fulfilled.then(result => {
        expect(result).to.have.property('id', user.id);
        expect(result).to.have.property('email', 'testuser@test.net');
      });
    });

    it('should update existing user', () => {
      const user = new User({
        email: 'testuser@test.net',
        name: 'test user',
        facebook: {
          id: 'fbfakeid123',
          email: 'testUser@test.net',
          name: 'test user'
        }
      });
      const p = User.createAsync(user).then(() => {
        const update = user.toJSON();
        update.name = 'updated user';
        return User.createOrUpdate(user.id, update);
      });
      return expect(p).to.be.fulfilled.then(result => {
        expect(result).to.have.property('id', user.id);
        expect(result).to.have.property('name', 'updated user');
      });
    });
  });

  it('should create a new user', () => {
    const data = userData.create();
    return expect(User.createAsync(data)).to.be.fulfilled.then(user => {
      expect(user).to.have.property('email', 'jhon@jhonhome.com');
      expect(user).to.have.property('password');
      expect(user).to.have.property('name', 'Jhon Bob');
      expect(user).to.have.property('followers').that.is.an('array');
      expect(user).to.have.deep.property('facebook.id', '12345');
    });
  });

  it('should give an error when email is missing', () => {
    const data = userData.create({ email: null });
    return expect(User.createAsync(data)).to.be.rejected.then( e => {
      expect(e).to.match(/email is required!/);
    });
  });

  it('should not save duplicate email', () => {
    const data = userData.create();
    const createUserPromise = User.createAsync(data).then(() =>
      User.createAsync(data));
    return expect(createUserPromise).to.be.rejected.then( e => {
      expect(e).to.match(/E11000 duplicate key error index/);
    });
  });

  it('should save hashed password on creation', () => {
    const data = userData.create();
    sinon.spy(bcrypt, 'hashAsync');
    const passwordCompare = User.createAsync(data).then(user => {
      expect(bcrypt.hashAsync).to.be.calledWith(data.password, 1);
      bcrypt.hashAsync.restore();
      return bcrypt.compareSync(data.password, user.password);
    });
    return expect(passwordCompare).to.be.eventually.true;
  });

  it('should hash with higher salt work factor in production', () => {
    const originalEnv = config.env;
    const hashAsync = sinon.stub(bcrypt, 'hashAsync');
    const data = userData.create();
    hashAsync.returns(Promise.resolve({}));
    config.env = 'production';
    return User.createAsync(data).then(() => {
      expect(bcrypt.hashAsync).to.be.calledWith(data.password, 10);
    }).finally(() => {
      config.env = originalEnv;
      hashAsync.restore();
    });
  });

  it('should not hash password if password is not modified', () => {
    const data = userData.create();
    sinon.spy(bcrypt, 'hashAsync');

    return User.createAsync(data).then(user => {
      user.firstName = 'bob';
      return user.saveAsync();
    }).then(() => {
      expect(bcrypt.hashAsync).to.have.been.calledOnce;
    }).finally(bcrypt.hashAsync.restore.bind(bcrypt.hashAsync));
  });

  it('should register device tokens to a user', () => {
    const data = userData.create();
    const tokens = [
      { token: 'userIphoneToken', os: 'ios' },
      { token: 'userIphoneToken', os: 'ios' },
      { token: 'userAndroidToken', os: 'android' }
    ];
    const registerTokenTo = user =>
      token =>
        User.registerDeviceToken(user.id, token.token, token.os)
          .then(result => {
            expect(result).to.have.property('userId', user.id);
            expect(result).to.have.property('token');
            expect(result).to.have.property('os');
          });

    return User.createAsync(data).then(user =>
      Promise.resolve(tokens)
        .each(registerTokenTo(user))
        .then(() => User.findByIdAsync(user.id))
    ).then(user => {
      expect(user.deviceTokens).to.be.length(2);
      expect(user.deviceTokens[0].token).to.equal('userIphoneToken');
      expect(user.deviceTokens[0].os).to.equal('ios');
      expect(user.deviceTokens[1].token).to.equal('userAndroidToken');
      expect(user.deviceTokens[1].os).to.equal('android');
    });
  });

  it('should remove same device token from previous user when a new user is registering with the same token', () => {
    const u1Data = userData.create({ name: 'Jhon' });
    const u2Data = userData.create({ email: 'sam@sam.net', name: 'Sam'});
    const promise = Promise.all([
      User.createAsync(u1Data),
      User.createAsync(u2Data)
    ]).each(user => {
      return User.registerDeviceToken(user.id, 'iphone1Token', 'ios');
    }).then(() => {
      return Promise.all([
        User.findOneAsync({ name: 'Jhon'}),
        User.findOneAsync({ name: 'Sam'})
      ]);
    });
    return expect(promise).to.be.fulfilled.then(users => {
      expect(users[0].deviceTokens).to.be.empty;
      expect(users[1].deviceTokens[0].token).to.equal('iphone1Token');
    });
  });

  describe('(user graph)', () => {
    let users;
    let targetUser;

    beforeEach(() => {
      users = [];
      for (let i = 1; i <= 3; i += 1) {
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

    it('should follow target user', () => {
      const promise = User.follow(users[0]._id, targetUser._id)
        .then(() => User.getFollowers(targetUser.id));
      return expect(promise).to.be.fulfilled.then(followers => {
        expect(followers[0]).to.have.property('name', 'From User1');
        expect(followers[0]).to.have.property('picture', 'profilePic1');
        expect(followers[0].userId.toString()).to.equal(users[0].id);
        expect(followers[0]._id).to.be.undefined;
      });
    });

    it('should emit follow event', done => {
      User.follow(users[0]._id, targetUser._id).then(() => {
        expect(eb.emit).to.not.have.been.called;
        // expect eb.emit called on next event loop cycle
        setImmediate(() => {
          expect(eb.emit).to.have.been
            .calledWith('userModel:follow', {
              userId: users[0]._id,
              toUserId: targetUser._id
            });
          done();
        });
      }).catch(done);
    });

    it('should not follow same user twice', () => {
      const promise = User.follow(users[1]._id, targetUser._id)
        .then(() => User.follow(users[1]._id, targetUser.id))
        .then(() => User.getFollowers(targetUser.id));
      return expect(promise).to.eventually.be.length(1);
    });

    it('should unfollow a user', () => {
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.unfollow(users[0]._id, targetUser.id))
        .then(() => User.getFollowers(targetUser.id));
      return expect(promise).to.eventually.be.length(0);
    });

    it('should limit and skip list of followers on getFollowers', () => {
      const options = { skip: 1, limit: 1 };
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[1]._id, targetUser.id))
        .then(() => User.follow(users[2]._id, targetUser.id))
        .then(() => User.getFollowers(targetUser.id, options));
      return expect(promise).to.be.fulfilled.then(result => {
        expect(result).to.be.length(1);
        expect(result[0].name).to.equal(users[1].name);
      });
    });

    it('should retrieve [] on getFollowers for unknown user', () => {
      const promise = User.getFollowers(mongoose.Types.ObjectId());
      return expect(promise).to.eventually.be.an('array').that.is.empty;
    });

    it('should retrive number of followers for a user', () => {
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[1]._id, targetUser.id))
        .then(() => User.getFollowerCount(targetUser.id));
      return expect(promise).to.eventually.equal(2);
    });

    it('should return 0 on getFollowersCount on non-exist user', () => {
      const promise = User.getFollowerCount(mongoose.Types.ObjectId());
      return expect(promise).to.eventually.equal(0);
    });

    it('should get following users list of the user', () => {
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.getFollowing(users[0].id));
      return expect(promise).to.be.fulfilled.then(following => {
        expect(following[0]).to.have.property('name', 'Target User');
        expect(following[0]).to.have.property('picture', 'profilePicT');
        expect(following[0].userId.toString()).to.equal(targetUser.id);
      });
    });

    it('should skip list of following users on getFollowing', () => {
      const options = { skip: 2 };
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[0]._id, users[1].id))
        .then(() => User.follow(users[0]._id, users[2].id))
        .then(() => User.getFollowing(users[0].id, options));
      return expect(promise).to.eventually.be.length(1);
    });

    it('should limit list of following users on getFollowing', () => {
      const options = { skip: 1, limit: 1 };
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[0]._id, users[1].id))
        .then(() => User.follow(users[0]._id, users[2].id))
        .then(() => User.getFollowing(users[0].id, options));
      return expect(promise).to.eventually.be.length(1);
    });

    it('should retrive number of following for a user', () => {
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[0]._id, users[1].id))
        .then(() => User.getFollowingCount(users[0].id));
      return expect(promise).to.eventually.equal(2);
    });

    it('should retrive following relationships (one to one)', () => {
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.getFollowingInfo(users[0].id, [targetUser.id]));
      return expect(promise).to.be.fulfilled.then(followingInfo => {
        expect(followingInfo[0]).to.have.property('name', 'Target User');
        expect(followingInfo[0]).to.have.property('userId', targetUser.id.toString());
        expect(followingInfo[0]).to.have.property('picture', targetUser.picture);
        expect(followingInfo[0]).to.have.property('following', true);
      });
    });

    it('should retrive following relationships (one to many)', () => {
      const targetUserIds = [targetUser.id, users[1].id, users[2].id];
      const promise = User.follow(users[0]._id, targetUser.id)
        .then(() => User.follow(users[1]._id, targetUser.id))
        .then(() => User.follow(users[0]._id, users[2].id))
        .then(() => User.getFollowingInfo(users[0].id, targetUserIds));
      return expect(promise).to.be.fulfilled.then(fInfo => {
        expect(fInfo).to.be.length(3);
        fInfo.forEach(info => {
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

  describe('#comparePassword', () => {
    it('should check for matching password', () => {
      const data = userData.create({ password: 'matchingPwd' });
      const isMatching = User.createAsync(data)
        .then(user => user.comparePassword('matchingPwd'));
      return expect(isMatching).to.eventually.be.true;
    });

    it('should check for wrong password', () => {
      const data = userData.create({ password: 'matchingPwd' });
      const isMatching = User.createAsync(data)
        .then(user => user.comparePassword('wrong'));
      return expect(isMatching).to.eventually.be.false;
    });
  });

  describe('#toJSON', () => {
    it('should return clean json', () => {
      const data = userData.create();
      const user = new User(data);
      expect(user.toJSON()).to.have.property('id');
      expect(user.toJSON()).to.not.have.property('_id');
      expect(user.toJSON()).to.not.have.property('__V');
      expect(user.toJSON()).to.not.have.property('password');
    });
  });
});
