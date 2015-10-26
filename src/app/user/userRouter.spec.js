/* eslint no-unused-expressions: 0 */
import methodOverride from 'method-override';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import Promise from 'bluebird';
import request from 'supertest';
import express from 'express';
import rewire from 'rewire';
import config from '../config';
import User from './user';
import jwt from 'jwt-simple';

const router = rewire('./router');

const testUser = new User({
  _id: mongoose.Types.ObjectId(),
  email: 'test@vogo.vogo',
  name: 'Test Vogo'
});

const mockRequireToken = (req, res, next) => {
  const token = req.headers['x-access-token'];
  if (token !== 'testToken') {
    return res.status(401).end();
  }
  req.user = testUser;
  next();
};

const createApp = () => {
  const app = express();
  app.use(bodyParser.json());
  app.use(methodOverride());
  router.__set__({
    requireToken: mockRequireToken
  });
  app.use(router());
  return request(app);
};

describe('User Router', () => {
  const app = createApp();

  it('should require authentication token', done => {
    app.post('/').expect(401, done);
  });

  describe('POST /login', () => {
    const path = '/login';

    it('should send 400 when no grantType field is provided', done => {
      const resBody = {
        status: 400,
        message: 'grantType field is missing or not valid'
      };
      app.post(path).send({}).expect(400, resBody, done);
    });

    describe('with password', () => {
      let user;

      beforeEach(done => {
        const data = {
          email: 'test@vogo.com',
          password: 'testpwd'
        };
        User.create(data, (err, newUser) => {
          if (err) { return done(err); }
          user = newUser;
          done();
        });
      });

      it('should send 200 with user object', done => {
        const reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        app.post(path).send(reqBody).expect(200, (err, res) => {
          if (err) { return done(err); }
          expect(res.body.user.email).to.equal('test@vogo.com');
          done();
        });
      });

      it('should send 200 with access_token', done => {
        sinon.stub(Date, 'now').returns(1417876057391);

        const ACCESS_TOKEN = jwt.encode({
          iss: user.id,
          exp: Date.now() + config.jwtexp
        }, config.jwtsecret);

        const reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };

        app.post(path).send(reqBody).expect(200, (err, res) => {
          Date.now.restore();
          if (err) { return done(err); }
          expect(res.body).to.have.deep.property('access_token', ACCESS_TOKEN);
          expect(res.body.user).to.not.have.property('followers');
          done();
        });
      });

      it('should send 401 when email is missing', done => {
        const reqBody = {
          grantType: 'password',
          password: 'testpwd'
        };
        const resBody = {
          status: 401,
          message: 'Invalid credentials'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when password is missing', done => {
        const reqBody = {
          email: 'test@vogo.com',
          grantType: 'password'
        };
        const resBody = {
          status: 401,
          message: 'Invalid credentials'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when password is wrong', done => {
        const reqBody = {
          email: 'test@vogo.com',
          grantType: 'password',
          password: 'wrongpwd'
        };
        const resBody = {
          status: 401,
          message: 'Password is not correct'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });

      it('should send 401 when user does not exist', done => {
        const reqBody = {
          email: 'nonexistinguser@vogo.com',
          grantType: 'password',
          password: 'testpwd'
        };
        const resBody = {
          status: 401,
          message: 'Can\'t find a user with that email'
        };
        app.post(path).send(reqBody).expect(401, resBody, done);
      });
    });

    describe('with facebook access token', () => {
      let revert;
      let mockRequest;
      let mockPUploader;
      let user;

      beforeEach(done => {
        const userData = {
          email: 'test@vogo.com',
          name: 'Test Vogo',
          picture: 'ppic',
          _updated: true,
          facebook: {
            id: 'fbtestid123',
            name: 'Test Vogo'
          }
        };
        User.create(userData, (err, newUser) => {
          if (err) { return done(err); }
          user = newUser;
          done();
        });
      });

      beforeEach(() => {
        mockRequest = sinon.stub();
        mockPUploader = sinon.stub();
        revert = router.__set__({
          request: mockRequest,
          pUploader: mockPUploader
        });
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{ "id": "fbtestid123", "email": "test@vogo.com", "name": "Test Vogo"}'
        ]));
      });

      afterEach(() => {
        revert();
      });

      it('should send 400 when facebook token is missing', done => {
        const reqBody = { grantType: 'facebook' };
        const resBody = {
          status: 400,
          message: 'A facebook access token is required'
        };
        app.post(path).send(reqBody).expect(400, resBody, done);
      });

      it('should send request to facebook to get profile', done => {
        const reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, err => {
          if (err) { return done(err); }
          expect(mockRequest).to.have.been
            .calledWith('https://graph.facebook.com/v2.3/me?fields=id,email,name,picture.type(large)&access_token=fakefbtk');
          done();
        });
      });

      it('should send 500 when it fails to get profile from facebook', done => {
        mockRequest.returns(Promise.resolve([{ statusCode: 400 }, '{}']));
        const reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        const resBody = {
          name: 'FacebookGraphAPIError',
          message: 'Failed to fetch facebook user profile',
          status: 500
        };
        app.post(path).send(reqBody).expect(500, resBody, done);
      });

      it('should send 200 with user object', done => {
        const reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, (err, res) => {
          if (err) { return done(err); }
          expect(res.body.user.id).to.equal(user.id);
          expect(res.body.user.email).to.equal('test@vogo.com');
          done();
        });
      });

      it('should send 200 with access_token', done => {
        sinon.stub(Date, 'now').returns(1417876057391);
        const ACCESS_TOKEN = jwt.encode({
          iss: user.id,
          exp: Date.now() + config.jwtexp
        }, config.jwtsecret);
        const reqBody = {grantType: 'facebook', facebookAccessToken: 'fakefbtk'};
        app.post(path).send(reqBody).expect(200, (err, res) => {
          Date.now.restore();
          if (err) { return done(err); }
          expect(res.body).to.have.deep.property('access_token', ACCESS_TOKEN);
          expect(res.body.user).to.not.have.property('followers');
          done();
        });
      });

      it('should send 201 with a newly created user when there\'s no user with given fb id', done => {
        const reqBody = {grantType: 'facebook', facebookAccessToken: 'anotherfakefbtk'};
        // predefine result for facebook profile request
        mockRequest.returns(Promise.resolve([{
          statusCode: 200
        },
        '{' +
        '   "id": "newFbId12345",' +
        '   "email": "sam@home.net",' +
        '   "name": "Sam Power",' +
        '   "picture": {"data": { "url": "profileUrl" } }' +
        '}'
        ]));
        mockPUploader.withArgs('profileUrl')
          .returns(Promise.resolve('s3ProfileUrl'));

        app.post(path).send(reqBody).expect(200, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.have.property('access_token').that.is.an('string');
          expect(res.body.user).to.have.property('name', 'Sam Power');
          expect(res.body.user).to.have.property('email', 'sam@home.net');
          expect(res.body.user).to.have.property('picture', 's3ProfileUrl');
          expect(res.body.user.facebook).to.have.property('id', 'newFbId12345');
          expect(res.body.user.facebook).to.have.property('email', 'sam@home.net');
          expect(res.body.user.facebook).to.have.property('name', 'Sam Power');
          done();
        });
      });

      it('should send 200 and update profile picture of existing user', done => {
        const existingUser = {
          email: 'test2@vogo.com',
          name: 'Test Vogo2',
          picture: 'previousProfilePic',
          facebook: {
            id: 'fbtestidpicturetest',
            name: 'Test Vogo2'
          }
        };
        User.create(existingUser, err => {
          if (err) { return done(err); }
          const reqBody = {grantType: 'facebook', facebookAccessToken: 'anotherfakefbtk'};

          mockRequest.returns(Promise.resolve([{
            statusCode: 200
          },
          '{' +
          '   "id": "fbtestidpicturetest",' +
          '   "email": "test2@vogo.com",' +
          '   "name": "Test Vogo2",' +
          '   "picture": {"data": { "url": "previousProfilePic" } }' +
          '}'
          ]));
          mockPUploader.withArgs('previousProfilePic')
            .returns(Promise.resolve('s3ProfileUrl'));

          app.post(path).send(reqBody).expect(200, (e, res) => {
            if (e) { return done(e); }
            expect(res.body).to.have.property('access_token').that.is.an('string');
            expect(res.body.user).to.have.property('name', 'Test Vogo2');
            expect(res.body.user).to.have.property('email', 'test2@vogo.com');
            expect(res.body.user).to.have.property('picture', 's3ProfileUrl');
            expect(res.body.user).to.have.property('_updated', true);
            expect(res.body.user.facebook).to.have.property('id', 'fbtestidpicturetest');
            expect(res.body.user.facebook).to.have.property('name', 'Test Vogo2');
            done();
          });
        });
      });
    });
  });

  describe('POST /deviceTokens', () => {
    const path = '/deviceTokens';

    it('should send 201', done => {
      sinon.stub(User, 'registerDeviceToken')
        .returns(Promise.resolve('returned token'));
      app.post(path)
        .set('x-access-token', 'testToken')
        .send({ token: 'testiosdevicetoken', os: 'ios' })
        .expect(201, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.equal('returned token');
          expect(User.registerDeviceToken).to.have.been
            .calledWith(testUser.id, 'testiosdevicetoken', 'ios');
          User.registerDeviceToken.restore();
          done();
        });
    });
  });

  describe('POST /users', () => {
    const path = '/users';

    it('should send 201 with user data', done => {
      app.post(path)
        .send({ email: 'testuser@vogo.com' })
        .expect(201, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.have.property('email', 'testuser@vogo.com');
          done();
        });
    });
  });

  describe('GET /users', () => {
    const path = '/users';

    beforeEach(done => {
      const users = [{email: 'bob@vogo.vogo'}, {email: 'sam@vogo.vogo'}];
      app.post(path)
        .send(users[0])
        .expect(201, () => app.post(path)
          .send(users[1])
          .expect(201, done));
    });

    it('should retreive array of users', done => {
      app.get(path)
        .set('x-access-token', 'testToken')
        .expect(200, (err, res) => {
          if (err) { return done(err); }
          expect(res.body).to.be.an('array');
          expect(JSON.stringify(res.body)).to.match(/bob@vogo.vogo/);
          expect(JSON.stringify(res.body)).to.match(/sam@vogo.vogo/);
          done();
        });
    });
  });

  describe('GET /users/{userId}', () => {
    const path = '/users';

    it('should retreive a specific user with id', done => {
      app.post(path)
        .send({ email: 'bob@vogo.vogo' })
        .expect(201, (err, res) => {
          if (err) { return done(err); }
          const userId = res.body.id;
          app.get(path + '/' + userId)
            .set('x-access-token', 'testToken')
            .expect(200, (error, response) => {
              if (error) { return done(error); }
              expect(response.body).to.have.property('email', 'bob@vogo.vogo');
              done();
            });
        });
    });
  });

  describe('PUT /users/{userId}/follwoing/{target}', () => {
    it('should send 403 if current user is not authorized', done => {
      const OTHER_USER_ID = mongoose.Types.ObjectId();
      const TARGET_ID = mongoose.Types.ObjectId();
      const path = '/users/' + OTHER_USER_ID + '/following/' + TARGET_ID;
      app.put(path).set('x-access-token', 'testToken').expect(403, done);
    });

    it('should send 200 with success', done => {
      sinon.stub(User, 'follow').returns(Promise.resolve({}));
      const targetUser = new User({
        _id: mongoose.Types.ObjectId(),
        email: 'target@address.com',
        name: 'Target User'
      });
      const path = '/users/' + testUser.id + '/following/' + targetUser.id;
      app.put(path).set('x-access-token', 'testToken')
        .expect(204, err => {
          if (err) { return done(err); }
          expect(User.follow).to.be.calledWith(testUser.id, targetUser.id);
          User.follow.restore();
          done();
        });
    });
  });

  describe('DELETE /users/{userId}/follwoing/{target}', () => {
    it('should send 403 if current user is not authorized', done => {
      const OTHER_USER_ID = mongoose.Types.ObjectId();
      const TARGET_ID = mongoose.Types.ObjectId();
      const path = '/users/' + OTHER_USER_ID + '/following/' + TARGET_ID;
      app.del(path).set('x-access-token', 'testToken').expect(403, done);
    });

    it('should send 200 with success', done => {
      sinon.stub(User, 'unfollow').returns(Promise.resolve({}));
      const targetUser = new User({
        _id: mongoose.Types.ObjectId(),
        email: 'target@address.com',
        name: 'Target User'
      });
      const path = '/users/' + testUser.id + '/following/' + targetUser.id;
      app.del(path).set('x-access-token', 'testToken')
        .expect(204, err => {
          if (err) { return done(err); }
          expect(User.unfollow).to.have.been
            .calledWith(testUser.id, targetUser.id);
          User.unfollow.restore();
          done();
        });
    });
  });

  describe('GET /users/{userId}/followers', () => {
    beforeEach(() => sinon.stub(User, 'getFollowers'));
    afterEach(() => User.getFollowers.restore());

    it('should send 200 with list of followers', done => {
      const path = '/users/' + testUser.id + '/followers';
      User.getFollowers
        .withArgs(testUser.id, { skip: 0, limit: 100 })
        .returns(Promise.resolve([{ name: 'follower' }]));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, [{ name: 'follower' }], done);
    });

    it('should 200 with pagination parameters', done => {
      const path = '/users/' + testUser.id + '/followers';
      User.getFollowers
        .withArgs(testUser.id, { skip: 2, limit: 10 })
        .returns(Promise.resolve([{ name: 'follower' }]));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({skip: 2, limit: 10})
        .expect(200, [{ name: 'follower' }], done);
    });
  });

  describe('GET /users/{userId}/followers-count', () => {
    beforeEach(() => sinon.stub(User, 'getFollowerCount'));
    afterEach(() => User.getFollowerCount.restore());

    it('should send 200 with followers count', done => {
      const path = '/users/' + testUser.id + '/followers-count';
      User.getFollowerCount
        .withArgs(testUser.id)
        .returns(Promise.resolve(3));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, { numberOfFollowers: 3 }, done);
    });
  });

  describe('GET /users/{userId}/following', () => {
    beforeEach(() => sinon.stub(User, 'getFollowing'));
    afterEach(() => User.getFollowing.restore());

    it('should send 200 with list of following users', done => {
      const path = '/users/' + testUser.id + '/following';
      User.getFollowing
        .withArgs(testUser.id, { skip: 0, limit: 100 })
        .returns(Promise.resolve([{ name: 'user' }]));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, [{ name: 'user' }], done);
    });

    it('should 200 with pagination parameters', done => {
      const path = '/users/' + testUser.id + '/following';
      User.getFollowing
        .withArgs(testUser.id, { skip: 2, limit: 10 })
        .returns(Promise.resolve([{ name: 'user' }]));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({skip: 2, limit: 10})
        .expect(200, [{ name: 'user' }], done);
    });
  });

  describe('GET /users/{userId}/following-count', () => {
    beforeEach(() => sinon.stub(User, 'getFollowingCount'));
    afterEach(() => User.getFollowingCount.restore());

    it('should send 200 with following count', done => {
      const path = '/users/' + testUser.id + '/following-count';
      User.getFollowingCount
        .withArgs(testUser.id)
        .returns(Promise.resolve(2));
      app.get(path).set('x-access-token', 'testToken')
        .expect(200, { numberOfFollowing: 2 }, done);
    });
  });

  describe('GET /relationships/follwoing', () => {
    beforeEach(() => sinon.stub(User, 'getFollowingInfo'));
    afterEach(() => User.getFollowingInfo.restore());

    it('should send 200', done => {
      const path = '/relationships/following';
      const uid = mongoose.Types.ObjectId().toString();
      User.getFollowingInfo
        .withArgs(testUser.id, [uid])
        .returns(Promise.resolve({ result: 'result' }));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({ userId: uid })
        .expect(200, { result: 'result' }, done);
    });

    it('should send 200 with array value userId parameter', done => {
      const path = '/relationships/following';
      const uid1 = mongoose.Types.ObjectId().toString();
      const uid2 = mongoose.Types.ObjectId().toString();
      User.getFollowingInfo
        .withArgs(testUser.id, [uid1, uid2])
        .returns(Promise.resolve({ result: 'result' }));
      app.get(path)
        .set('x-access-token', 'testToken')
        .query({ userId: [uid1, uid2] })
        .expect(200, { result: 'result' }, done);
    });

    it('should send if userId parameter is missing', done => {
      const resBody = {
        status: 400,
        message: 'userId parameter is required'
      };
      const path = '/relationships/following';
      const uid = mongoose.Types.ObjectId().toString();
      User.getFollowingInfo
        .withArgs(testUser.id, [uid])
        .returns(Promise.resolve({ result: 'result' }));
      app.get(path)
        .set('x-access-token', 'testToken')
        .expect(400, resBody, done);
    });
  });
});
