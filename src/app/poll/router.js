import expressJwt from 'express-jwt';
import config from '../config';
import errorhandler from 'api-error-handler';
import express from 'express';
import Poll from './poll';
import Vote from './vote';

const publish = function (req, res, next) {
  // TODO: input validation with req.body
  Poll.publish(req.user.uid, req.body)
    .then(res.status(201).json.bind(res))
    .catch(next);
};

const vote = function (req, res, next) {
  // TODO: input validation
  Vote.createNew(req.user.uid, req.params.id, req.body.answer)
    .then(function (data) {
      if (!data) {
        throw {
          status: 404,
          message: 'poll not found or already voted with the user'
        };
      }
      res.status(201).json(data);
    }).catch(next);
};

const comment = function (req, res, next) {
  // TODO: input validation
  const pollId = req.params.id;
  Poll.comment(pollId, req.user.uid, req.body.text).then(function (poll) {
    if (!poll) {
      throw { status: 404, message: 'poll not found' };
    }
    const newComment = poll.comments[poll.comments.length - 1];
    res.status(201).json(newComment);
  }).catch(next);
};

const getComments = function (req, res, next) {
  const pollId = req.params.id;
  const options = {};
  options.skip = parseInt(req.query.skip, 10) || 0;
  options.limit = parseInt(req.query.limit, 10) || 20;
  Poll.getComments(pollId, options).then(res.json.bind(res)).catch(next);
};

const getPollById = function (req, res, next) {
  Poll.getById(req.params.id).then(res.json.bind(res)).catch(next);
};

const getUserPolls = function (req, res, next) {
  const userId = req.params.id;
  const beforePollId = req.query.before || null;
  const limit = 20;
  Poll.getByUserId(userId, beforePollId, limit)
    .then(res.json.bind(res))
    .catch(next);
};

const getUserVotes = function (req, res, next) {
  const userId = req.params.id;
  const pollIds = req.query.pollIds;
  const beforeVoteId = req.query.before || null;
  const limit = 20;
  if (pollIds) {
    // if pollids are provided, get provided user's votes on provided pollIds
    // (it lets you check if a user voted on provided polls)
    return Vote.getByUserIdAndPollIds(userId, [].concat(pollIds))
      .then(res.json.bind(res))
      .catch(next);
  }
  Vote.getByUserId(userId, beforeVoteId, limit)
    .then(res.json.bind(res))
    .catch(next);
};

const getVoters = function (req, res, next) {
  const pollId = req.params.id;
  const answer = req.query.answer;
  const options = {};

  options.limit = parseInt(req.query.limit || 100, 10);
  options.skip = parseInt(req.query.skip || 0, 10);

  return Vote.getVotersFor(pollId, parseInt(answer, 10), options)
    .then(res.json.bind(res))
    .catch(next);
};

const getRecentUnvotedPolls = function (req, res, next) {
  const { before, exclude } = req.query;
  return Poll.getRecentUnvoted(req.user.uid, before, [].concat(exclude))
    .then(res.json.bind(res))
    .catch(next);
};

export default () => {
  const router = express.Router();

  router.use(expressJwt({
    secret: config.jwtsecret,
    getToken: req => req.headers['x-access-token'] || null
  }));

  router.post('/polls', publish);
  router.post('/polls/:id/votes', vote);
  router.post('/polls/:id/comments', comment);

  router.get('/polls/:id', getPollById);
  router.get('/polls/:id/comments', getComments);

  router.get('/polls/:id/voters', getVoters);

  router.get('/users/:id/polls', getUserPolls);
  router.get('/users/:id/votes', getUserVotes);

  // Need Test
  router.get('/polls', getRecentUnvotedPolls);

  router.use(errorhandler());
  return router;
};
