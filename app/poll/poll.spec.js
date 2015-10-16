/* eslint no-unused-expressions: 0 */
import mongoose from 'mongoose';
import Promise from 'bluebird';
import eb from 'app/eventBus';
import _ from 'lodash';
import Poll from './poll';

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

describe('Poll', () => {
  let user;

  beforeEach(() => {
    user = {
      name: 'Bob',
      picture: 'profilePic',
      id: mongoose.Types.ObjectId()
    };
    sinon.stub(eb, 'emit');
  });
  afterEach(() => eb.emit.restore());

  it('should publish and return a new poll', () => {
    const data = createPollData();
    let pollFromCreate;
    const promise = Poll.publish(user, data).then(poll => {
      pollFromCreate = poll;
      return Poll.getById(poll.id);
    });
    return expect(promise).to.eventually.be.fulfilled.then(poll => {
      const expectAndValidate = poll => {
        expect(poll.createdBy.userId.toString()).to.equal(user.id.toString());
        expect(poll).to.have.deep.property('createdBy.name', 'Bob');
        expect(poll).to.have.deep.property('createdBy.picture', 'profilePic');

        expect(poll).to.have.property('question', 'which sports?');
        expect(poll).to.have.deep.property('answer1.text', 'basketball');
        expect(poll).to.have.deep.property('answer1.picture', 'a1picurl');
        expect(poll).to.have.deep.property('answer1.numVotes', 0);
        expect(poll).to.have.deep.property('answer2.text', 'soccer');
        expect(poll).to.have.deep.property('answer2.picture', 'a2picurl');
        expect(poll).to.have.deep.property('answer2.numVotes', 0);
      };
      expectAndValidate(pollFromCreate);
      expect(pollFromCreate.subscribers[0].toString())
        .to.equal(user.id.toString());

      expectAndValidate(poll);
      expect(poll).to.not.have.deep.property('answer1.voters');
      expect(poll).to.not.have.deep.property('answer2.voters');
      expect(poll).to.not.have.property('comments');
      expect(poll).to.not.have.property('subscribers');
    });
  });

  it('should emit an event when poll is published', done => {
    const data = createPollData();

    expect(Poll.publish(user, data)).to.be.fulfilled.then(poll => {
      // expect eb.emit called on next event loop cycle
      expect(eb.emit).to.have.not.been.calledWith('pollModel:publish');
      setImmediate(() => {
        expect(eb.emit).to.have.been.calledWith('pollModel:publish', {
          user: user,
          poll: poll
        });
        done();
      });
    }).catch(done);
  });

  it('should get polls in decending order by id for a user', () => {
    const poll1 = createPollData({ question: 'poll1' }),
        poll2 = createPollData({ question: 'poll2' }),
        poll3 = createPollData({ question: 'poll3' }),
        user2 = {
          name: 'Sam',
          picture: 'pfpic',
          id: mongoose.Types.ObjectId()
        };

    const promise = Poll.publish(user, poll1)
      .then(() => Poll.publish(user2, poll3))
      .then(() => Poll.publish(user, poll2))
      .then(() => Poll.getByUserId(user.id));

    return expect(promise).to.be.fulfilled.then(polls => {
      expect(polls).to.have.length(2);
      expect(polls[0].question).to.equal(poll2.question);
      expect(polls[1].question).to.equal(poll1.question);
    });
  });

  it('should exclude array values on #getByUserId', () => {
    const poll1 = createPollData({ question: 'poll1' });

    const promise = Poll.publish(user, poll1).then(() =>
      Poll.getByUserId(user.id));

    return expect(promise).to.be.fulfilled.then(polls => {
      expect(polls[0].answer1.voters).to.be.undefined;
      expect(polls[0].answer2.voters).to.be.undefined;
      expect(polls[0].comments).to.be.undefined;
      expect(polls[0].votes).to.be.undefined;
    });
  });

  it('should limit the number of result', () => {
    const poll1 = createPollData({ question: 'poll1' }),
        poll2 = createPollData({ question: 'poll2' });

    const promise = Poll.publish(user, poll1)
      .then(poll1 => Poll.publish(user, poll2))
      .then(() => Poll.getByUserId(user.id, null, 1));

    return expect(promise).to.eventually.have.length(1);
  });

  it('should get polls before provided poll id with limit', () => {
    const poll1 = createPollData({ question: 'poll1' });
    const poll2 = createPollData({ question: 'poll2' });
    const poll3 = createPollData({ question: 'poll3' });
    const poll4 = createPollData({ question: 'poll4' });
    let poll3Id;

    const promise = Poll.publish(user, poll1)
      .then(() => Poll.publish(user, poll2))
      .then(() => Poll.publish(user, poll3))
      .then(poll => {
        poll3Id = poll.id;
        return Poll.publish(user, poll4);
      })
      .then(() => Poll.getByUserId(user.id, poll3Id, 1));

    return expect(promise).to.be.fulfilled.then(polls => {
      expect(polls).to.have.length(1);
      expect(polls[0].question).to.equal('poll2');
    });
  });

  it('should vote an answer for the poll', () => {
    const user2 = {
      name: 'Sam',
      picture: 'pfpic',
      id: mongoose.Types.ObjectId()
    };
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id, 1);
    })
    .then(() => Poll.voteAnswer(pollId, user2.id, 2))
    .then(() => Poll.findByIdAsync(pollId));
    return expect(promise).to.be.fulfilled.then(poll => {
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id.toString());
      expect(poll.answer2.numVotes).to.equal(1);
      expect(poll.answer2.voters[0].toString()).to.equal(user2.id.toString());
    });
  });

  it('should return updated poll when voted', () => {
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.voteAnswer(poll.id, user.id, 1);
    });
    return expect(promise).to.be.fulfilled.then(poll => {
      expect(poll.id).to.equal(pollId);
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id.toString());
    });
  });

  it('should give error when vote with invalid answerNumber', () => {
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id);
    });
    return expect(promise).to.be
      .rejectedWith('Invalid answer: answer must be either number 1 or 2');
  });

  it('should not vote same poll twice with same user', () => {
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.voteAnswer(pollId, user.id, 1);
    })
    .then(() => Poll.voteAnswer(pollId, user.id, 1))
    .then(() => Poll.voteAnswer(pollId, user.id, 2))
    .then(() => Poll.findByIdAsync(pollId));

    return expect(promise).to.be.fulfilled.then(poll => {
      expect(poll.answer1.numVotes).to.equal(1);
      expect(poll.answer1.voters[0].toString()).to.equal(user.id.toString());
      expect(poll.answer2.numVotes).to.equal(0);
      expect(poll.answer2.voters).to.be.empty;
    });
  });

  it('should emit an event when poll is voted', done => {
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.voteAnswer(poll.id, user.id, 1);
    });

    expect(promise).to.be.fulfilled.then(poll => {
      // expect eb.emit called on next event loop cycle
      expect(eb.emit).to.have.not.been.calledWith('pollModel:vote');
      setImmediate(() => {
        expect(eb.emit).to.have.been.calledWith('pollModel:vote', {
          userId: user.id,
          poll: poll,
          answer: 1
        });
        done();
      });
    }).catch(done);
  });

  it('should not emit an event when voted on invalid poll', done => {
    const promise = Poll.voteAnswer(mongoose.Types.ObjectId(), user.id, 1);

    expect(promise).to.be.fulfilled.then(poll => {
      expect(poll).to.be.null;
      setImmediate(() => {
        expect(eb.emit).to.have.not.been.called;
        done();
      });
    }).catch(done);
  });

  it('should add comment to a poll and return updated poll', () => {
    let pollId, poll;
    const id = mongoose.Types.ObjectId();
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'hello');
    }).then(result => {
      poll = result;
      return Poll.getComments(pollId);
    });
    return expect(promise).to.be.fulfilled.then(comments => {
      expect(poll.subscribers).to.be.length(1);

      expect(poll.comments[0]).to.have.property('_id');
      expect(poll.comments[0]).to.have.property('text', 'hello');
      expect(poll.comments[0].createdBy.userId.toString()).to.equal(user.id.toString());
      expect(poll.comments[0]).to.have.deep.property('createdBy.name', user.name);
      expect(poll.comments[0]).to.have.deep.property('createdBy.picture', user.picture);

      expect(comments[0]).to.have.property('_id');
      expect(comments[0]).to.have.property('text', 'hello');
      expect(comments[0].createdBy.userId.toString()).to.equal(user.id.toString());
      expect(comments[0]).to.have.deep.property('createdBy.userId');
      expect(comments[0]).to.have.deep.property('createdBy.name', user.name);
      expect(comments[0]).to.have.deep
        .property('createdBy.picture', user.picture);
    });
  });

  it('should add comment author to the subscribers', () => {
    let pollId, poll;

    const cris = {
      name: 'Cris',
      picture: 'crisProfilePic',
      id: mongoose.Types.ObjectId()
    };
    const promise = Poll.publish(user, createPollData()).then(poll => {
      return Poll.comment(poll.id, cris, 'hello');
    });
    return expect(promise).to.be.fulfilled.then(poll => {
      expect(poll.subscribers).to.be.length(2);
      expect(poll.subscribers[1].toString()).to.equal(cris.id.toString());
    });
  });

  it('should emit event after comment is created', done => {
    const promise = Poll.publish(user, createPollData())
    .then(poll => Poll.comment(poll.id, user, 'new comment'));

    return expect(promise).to.be.fulfilled.then(updatedPoll => {
      // should emit on next event loop cycle
      expect(eb.emit).to.not.have.been.calledWith('pollModel:comment');
      setImmediate(() => {
        expect(eb.emit).to.have.been.calledWith('pollModel:comment', {
          userId: user.id,
          poll: updatedPoll
        });
      });
      done();
    }).catch(done);
  });

  it('should not emit event when commenting on invalid poll', done => {
    const promise = Poll.comment(mongoose.Types.ObjectId(), user, 'new comment');

    return expect(promise).to.be.fulfilled.then(poll => {
      expect(poll).to.be.null;
      setImmediate(() => {
        expect(eb.emit).to.have.not.been.called;
      });
      done();
    }).catch(done);
  });

  it('should update number of comments of the poll', () => {
    let pollId;
    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'hello');
    })
    .then(() => Poll.getById(pollId));

    return expect(promise).to.eventually.have.property('numComments', 1);
  });

  it('should get empty array for comments', () => {
    const promise = Poll.getComments(mongoose.Types.ObjectId());
    return expect(promise).to.eventually.be.an('array').that.is.empty;
  });

  it('should paginate comments on getComments', () => {
    const options = { skip: 1, limit: 2 };
    let pollId;

    const promise = Poll.publish(user, createPollData()).then(poll => {
      pollId = poll.id;
      return Poll.comment(pollId, user, 'first');
    })
    .then(() => Poll.comment(pollId, user, 'second'))
    .then(() => Poll.comment(pollId, user, 'third'))
    .then(() => Poll.comment(pollId, user, 'fourth'))
    .then(() => Poll.getComments(pollId, options));

    return expect(promise).to.be.fulfilled.then(comments => {
      expect(comments).to.be.length(2);
      expect(comments[0].text).to.equal('second');
      expect(comments[1].text).to.equal('third');
    });
  });

  it('should have #toJSON to get clean json', () => {
    const data = createPollData();
    data.someWeird = 'adsjfklsdfjalsdfjsalkdfjskldf';
    const poll = new Poll(data);
    expect(poll.toJSON()).to.have.property('id');
    expect(poll.toJSON()).to.not.have.property('_id');
    expect(poll.toJSON()).to.not.have.property('__V');
    expect(poll.toJSON()).to.not.have.property('_random');
  });
});
