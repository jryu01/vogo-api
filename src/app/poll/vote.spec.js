/* eslint no-unused-expressions: 0 */
import mongoose from 'mongoose';
import Promise from 'bluebird';
import User from '../user/user';
import Poll from './poll';
import eb from '../eventBus';
import _ from 'lodash';
import Vote from './vote';

const createPollData = overwrites =>
  _.extend({
    question: 'which sports?',
    answer1: {
      text: 'basketball',
      picture: 'a1picurl'
    },
    answer2: {
      text: 'soccer',
      picture: 'a2picurl'
    }
  }, overwrites);

const promiseUsers = numUsers =>
  numUsers === 0 ? [] : [
    ...promiseUsers(numUsers - 1),
    User.createAsync({
      email: 'user' + numUsers + '@test.com',
      name: 'user' + numUsers,
      picture: 'userpic' + numUsers
    }),
  ];
const createUsers = numUsers => Promise.all(promiseUsers(numUsers));

describe('Vote', () => {
  let user;

  beforeEach(done => {
    sinon.stub(eb, 'emit');
    user = new User({
      name: 'Bob',
      email: 'bob@mail.net',
      picture: 'profilePic'
    });
    user.save(done);
  });
  afterEach(() => eb.emit.restore());

  it('should create a vote', () => {
    const promise = Poll.publish(user.id, createPollData())
      .then(poll => Vote.createNew(user.id, poll.id, 1));
    return expect(promise).to.eventually.be.fulfilled.then(vote => {
      expect(vote).to.have.property('_user');
      expect(vote).to.have.property('answer');
      expect(vote).to.have.property('_poll');
    });
  });

  it('should return null when creating to non-existing poll', () => {
    const promise = Poll.publish(user.id, createPollData())
      .then(() => Vote.createNew(user.id, mongoose.Types.ObjectId(), 1));
    return expect(promise).to.eventually.be.null;
  });

  it('should get votes for user by provided pollIds', () => {
    let pollList;
    let pollIds;
    const promise = Promise.all([
      Poll.publish(user.id, createPollData({ question: 'poll1' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll2' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll3' }) ),
    ]).then(polls => {
      pollList = polls;
      pollIds = pollList.map(poll => poll.id);
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(() => Vote.createNew(user.id, pollList[1].id, 2))
      .then(() => Vote.createNew(user.id, pollList[2].id, 1))
      .then(() => Vote.getByUserIdAndPollIds(user.id, pollIds));

    return expect(promise).to.be.fulfilled.then(votes => {
      expect(votes).to.have.length(3);
      expect(votes[0]._poll.toString()).to.equal(pollIds[2].toString());
      expect(votes[1]._poll.toString()).to.equal(pollIds[1].toString());
      expect(votes[2]._poll.toString()).to.equal(pollIds[0].toString());
    });
  });

  it('should get votes for a user decending order by _id', () => {
    let pollList;
    const promise = Promise.all([
      Poll.publish(user.id, createPollData({ question: 'poll1' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll2' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll3' }) ),
    ]).then(polls => {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(() => Vote.createNew(user.id, pollList[1].id, 2))
      .then(() => Vote.createNew(user.id, pollList[2].id, 1))
      .then(() => Vote.getByUserId(user.id));

    return expect(promise).to.be.fulfilled.then(votes => {
      expect(votes).to.have.length(3);
      expect(votes[0]._poll.question).to.equal('poll3');
      expect(votes[1]._poll.question).to.equal('poll2');
      expect(votes[2]._poll.question).to.equal('poll1');
    });
  });

  it('should exclude array values on #getByUserId', () => {
    const promise = Poll.publish(user.id, createPollData({question: 'poll1'}))
      .then(poll => Vote.createNew(user.id, poll.id, 1))
      .then(() => Vote.getByUserId(user.id));

    return expect(promise).to.be.fulfilled.then(votes => {
      expect(votes[0]._poll.answer1.voters).to.be.undefined;
      expect(votes[0]._poll.answer2.voters).to.be.undefined;
      expect(votes[0]._poll.comments).to.be.undefined;
      expect(votes[0]._poll.votes).to.be.undefined;
    });
  });

  it('should limit the number of result', () => {
    let pollList;
    const promise = Promise.all([
      Poll.publish(user.id, createPollData({ question: 'poll1' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll2' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll3' }) )
    ]).then(polls => {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    }).then(() => Vote.createNew(user.id, pollList[1].id, 2))
      .then(() => Vote.createNew(user.id, pollList[2].id, 1))
      .then(() => Vote.getByUserId(user.id, null, 1));

    return expect(promise).to.eventually.have.length(1);
  });

  it('should get votes before provided vote id with limit', () => {
    let pollList;
    let voteId;
    const promise = Promise.all([
      Poll.publish(user.id, createPollData({ question: 'poll1' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll2' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll3' }) ),
      Poll.publish(user.id, createPollData({ question: 'poll4' }) ),
    ]).then(polls => {
      pollList = polls;
      return Vote.createNew(user.id, pollList[0].id, 1);
    })
    .then(() => Vote.createNew(user.id, pollList[1].id, 2))
    .then(() => Vote.createNew(user.id, pollList[2].id, 1))
    .then(vote => {
      voteId = vote.id;
      return Vote.createNew(user.id, pollList[3].id, 1);
    })
    .then(() => Vote.getByUserId(user.id, voteId, 1));

    return expect(promise).to.be.fulfilled.then(votes => {
      expect(votes).to.have.length(1);
      expect(votes[0]._poll.question).to.equal('poll2');
    });
  });

  it('should get voters for a pollId by answer', () => {
    let pollId;
    // create a poll
    const promise = Poll.publish(user.id, createPollData()).then(poll => {
      pollId = poll.id;
      // create users
      return createUsers(3);
    }).each((userData, index) => {
      const answer = (index === 1) ? 2 : 1;
      return Vote.createNew(userData.id, pollId, answer);
    }).then(() => Vote.getVotersFor(pollId, 1));

    return expect(promise).to.be.fulfilled.then(voters => {
      expect(voters).to.have.length(2);

      // expect users are sorted ind revers order of the createion of the vote
      expect(voters[0]).to.have.property('name', 'user3');
      expect(voters[1]).to.have.property('name', 'user1');

      expect(voters[0]).to.not.have.property('followers');
    });
  });

  it('should get voters with pagination', () => {
    let pollId;
    // create a poll
    const promise = Poll.publish(user.id, createPollData()).then(poll => {
      pollId = poll.id;
      return createUsers(4);
    }).each(userData => Vote.createNew(userData.id, pollId, 2))
      .then(() => Vote.getVotersFor(pollId, 2, { skip: 1, limit: 2 }));

    return expect(promise).to.be.fulfilled.then(voters => {
      expect(voters).to.have.length(2);
      // expect users are sorted ind reverse order of the createion of the vote
      expect(voters[0]).to.have.property('name', 'user3');
      expect(voters[1]).to.have.property('name', 'user2');
    });
  });

  it('should have #toJSON to get clean json', () => {
    const vote = new Vote({ answer: 1});
    expect(vote.toJSON()).to.have.property('id');
    expect(vote.toJSON()).to.not.have.property('_id');
    expect(vote.toJSON()).to.not.have.property('__V');
  });
});
