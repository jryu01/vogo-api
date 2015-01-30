'use strict';
/*jshint expr: true*/

var Promise = require('bluebird'),
    _ = require('lodash'),
    chai = require('chai'),
    expect = chai.expect,
    sinon = require('sinon'),
    rewire = require('rewire'),
    sinonChai = require('sinon-chai'),
    chaiAsPromised = require("chai-as-promised");
chai.use(sinonChai);
chai.use(chaiAsPromised);



// var reqFactory = {
//   create: function (overwrites) {
//     var defaults = {
//       body: {
//         name: 'Basketball tournament'
//       },
//       params: {},
//       query: {},
//     };
//     return _.extend(defaults, overwrites);
//   }
// };

// describe('pollController', function () {

//   var controller, req, res, Activity;

//   beforeEach(function () {
//     Activity = { 
//       createAsync: sinon.stub(), 
//       findAsync: sinon.stub(),
//       findByIdAsync: sinon.stub()
//     };
//     req = reqFactory.create(); 
//     res = {};

//     controller = rewire('../../../lib/poll/pollController');
//     controller.__set__({
//       Activity: Activity
//     });
//   });

//   describe('#post', function () {

//     beforeEach( function () {
//       req.user = { id: '12345' };
//       Activity.createAsync.returns(Promise.resolve('default behaviour'));
//     });

//     it('should return a promise', function () {
//       expect(controller.post(req, res)).to.be.an('object'); 
//       expect(controller.post(req, res).then).to.be.a('function'); 
//     });

//     it('should resolve activity', function () {
//       Activity
//         .createAsync
//         .withArgs({name: 'Basketball tournament', organizer: { id: '12345' }})
//         .returns(Promise.resolve({ name: "new activity"}));

//       return expect(controller.post(req, res))
//               .to.eventually.deep.equal({ name: 'new activity'});
//     });
//   });

//   describe('#list', function () {
//     beforeEach(function () {
//       Activity.findAsync.returns(Promise.resolve([{activity: 'default'}]));
//     });

//     it('should return a promise', function () {
//       expect(controller.list(req, res)).to.be.an('object'); 
//       expect(controller.list(req, res).then).to.be.a('function'); 
//     });

//     it('should resolve list of activities', function () {
//       Activity.findAsync.withArgs({})
//         .returns(Promise.resolve([{activity: 'found'}]));

//       return expect(controller.list(req, res))
//         .to.eventually.deep.equal([{activity: 'found'}]);
//     });

//     it('should find only 10 activities at a time', function () {
//       controller.list(req, res);
//       var findCallArgs = Activity.findAsync.args[0];
//       expect(findCallArgs[2]).to.have.property('limit', 10);
//     });

//     it('should find activities sorted by startTime in increasing order and' +
//       ' updateTime in decreasing order', function () {
//       controller.list(req, res);
//       var findCallArgs = Activity.findAsync.args[0];
//       expect(findCallArgs[2]).to.have.property('sort');
//       expect(findCallArgs[2].sort).to.deep.equal({ 
//         startTime: 1, updatedTime: -1 
//       });
//     });

//     it('should find activities with startTime greater than or equal to provided startTime', 
//       function () {
//       req.query = { 
//         lastItemStartTime: '2014-10-28T02:16:32.492Z'
//       };
//       controller.list(req, res);
//       var findCallArgs = Activity.findAsync.args[0];
//       expect(findCallArgs[0]).to.deep.equal({
//         startTime: { $gte: '2014-10-28T02:16:32.492Z'}
//       });
//     });

//     it('should find activities with startTime equal to provided startTime and updatedTime less than provided updatedTime or activities with startTime greater than provided startTime', function () {
//       req.query = { 
//         lastItemStartTime: '2014-10-28T02:16:32.492Z',
//         lastItemUpdatedTime: '2014-09-28T02:16:32.492Z' 
//       };
//       controller.list(req, res);
//       var findCallArgs = Activity.findAsync.args[0];
//       expect(findCallArgs[0]).to.deep.equal({
//         $or: [{ 
//           startTime: '2014-10-28T02:16:32.492Z',
//           updatedTime: { $lt: '2014-09-28T02:16:32.492Z' }
//         },
//         {
//           startTime: { $gt: '2014-10-28T02:16:32.492Z' }
//         }] 
//       });
//     });

//     it('should ignore if only lastItemUpdatedTime query param is provided without lastItemStartTime', function () {
//       req.query = { lastItemUpdatedTime: '2014-09-28T02:16:32.492Z' };
//       controller.list(req, res);
//       expect(Activity.findAsync).to.have.been.called;
//       expect(Activity.findAsync).to.have.been.calledWith({});
//     });
//   });

//   describe('#get', function () {

//     beforeEach(function () {
//       req.params.id = '123abcd';
//       Activity
//         .findByIdAsync.withArgs('123abcd')
//         .returns(Promise.resolve({activity: 'Jhon'}));
//     });

//     it('should return a promise', function () {
//       expect(controller.get(req, res)).to.be.an('object'); 
//       expect(controller.get(req, res).then).to.be.a('function'); 
//     });

//     it('should resolve an activity', function () {
//       return expect(controller.get(req, res))
//               .to.eventually.deep.equal({ activity: 'Jhon'});
//     });
//   });
// });