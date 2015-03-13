'use strict';
// this is mock to replace real bcrypt module because
// hsaing is too expensive

var mockBcrypt = {
  genSalt: function (saltWorkFactor, cb){
    return cb(null, saltWorkFactor);
  },
  hash: function (pwd, salt, cb) {
    var fakeHash = 'ASFEW24JKSF' + pwd +'D12fj#jkdf' + salt;
    return cb(null, fakeHash);
  },
  compare: function (candidatePwd, pwd, cb) {
    var match = pwd.indexOf(candidatePwd) >= 0;
    return cb(null, match); 
  }
};

// module.exports = Promise.promisifyAll(mockBcrypt);
module.exports = mockBcrypt;