'use strict';

const Promise = require('bluebird');
const request = require('request');
const config = require('app/config');
const knox = require('knox');

// TODO: unit test

const uploadProfilePicture = module.exports = function (srcUrl, uid) {
  const client = knox.createClient({
    key: config.aws.accessKey,
    secret: config.aws.secretKey || 'r/MmGECROKpoXJFDR0OpDE2Sx0QSOrUFZxoEpw5c',
    bucket: config.aws.bucket
  });
  return new Promise(function (resolve, reject) {
    request.get(srcUrl).on('response', function (res) {
      if (res.statusCode === 200) {
        const headers = {
            'x-amz-acl': 'public-read',
            'Content-Length': res.headers['content-length'],
            'Content-Type': res.headers['content-type']
        };
        const path = uid + '/profile.jpg';
        const req = client.putStream(res, path, headers, function (err, res) {
          if (err) { return reject(err); }
          if (res.statusCode === 200) {
            resolve(req.url);
          } else {
            reject('S3 upload failed');
          }
        });
      } else {
        reject('Failed to get picture with given url: ' + res.statusCode);
      }
    }).on('error', reject);
  });
};
