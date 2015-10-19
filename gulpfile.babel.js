import fs from 'fs';
import gulp from 'gulp';
import babel from 'gulp-babel';
import mocha from 'gulp-mocha';
import eslint from 'gulp-eslint';
import cache from 'gulp-cached';
import changed from 'gulp-changed';
import nodemon from 'gulp-nodemon';

const SRC = 'src/**/*.js';
const DEST = 'dist';
const NODE_FILES = ['src/*.js', 'src/app/**/*.js'];
const NODE_TEST_FILES = ['src/app/**/*.spec.js', 'src/*.spec.js'];

gulp.task('lint', () => gulp.src(NODE_FILES)
  .pipe(cache('linting'))
  .pipe(eslint())
  .pipe(eslint.format())
  .pipe(eslint.failAfterError()));

gulp.task('test', () => gulp.src(NODE_TEST_FILES)
  .pipe(mocha({ reporter: 'dot'})));

gulp.task('babel', () => gulp.src(SRC)
  .pipe(changed(DEST))
  .pipe(babel())
  .pipe(gulp.dest(DEST)));

gulp.task('default', ['lint', 'test']);

gulp.task('serve', ['babel'], () => nodemon({
  ignore: DEST,
  tasks: ['babel'],
  script: './dist/index.js',
  ext: 'js',
  env: JSON.parse(fs.readFileSync('./.envconfig', 'utf-8'))
}));

gulp.task('watch', () => {
  gulp.watch(NODE_FILES, ['lint', 'test']);
});

// var gulp = require('gulp'),
//     exec = require('child_process').exec,
//     karma = require('karma'),
//     mocha = require('gulp-mocha'),
//     gutil = require('gulp-util'),
//     jshint = require('gulp-jshint'),
//     stylish = require('jshint-stylish');

// var NODE_VERSION = '0.12.7', // must be in the form of [major].[minor].[patch]
//     GENERATED_DIR = 'generated',
//     TEMP_TEST_DIR =  GENERATED_DIR + '/test',
//     NODE_FILES = ['src/server/**/*.js', 'src/*.js', './gulpfile.js'],
//     NODE_TEST_FILES = ['src/server/**/*.spec.js', 'src/*.spec.js'],
//     CLIENT_FILES = ['src/client/**/*.js'];

// // Ensures the node version.
// gulp.task('nodev', function (done) {

//   var parseNodeVersion = function (versionString) {
//     return versionString.split('.').map(function (v) {
//       return parseInt(v, 10);
//     });
//   };

//   var actual = parseNodeVersion(process.versions.node);
//   var expected = parseNodeVersion(NODE_VERSION);
//   var failError = new Error(
//     'Incorrect node version. Expected atleast ' +
//     NODE_VERSION + ', but was ' + process.versions.node
//   );
//   failError.showStack = false;
//   if (actual[0] < expected[0]) {
//     return done(failError);
//   }
//   if (actual[0] === expected[0] && actual[1] < expected[1]) {
//     return done(failError);
//   }
//   if (actual[0] === expected[0] && actual[1] === expected[1] && actual[2] < expected[2]) {
//     return done(failError);
//   }
//   return done();
// });

// // Generates a test directory
// gulp.task('testdir', function (done) {
//   exec('mkdir -p ' + TEMP_TEST_DIR, function (error, stdout, stderr) {
//     if (error) {
//       error.showStack = false;
//       return done(error);
//     }
//     return done();
//   });
// });

// // Clean up generated files
// gulp.task('clean', function (done) {
//   exec('rm -rf ' + GENERATED_DIR, function (error, stdout, stderr) {
//     if (error) {
//       error.showStack = false;
//       return done(error);
//     }
//     return done();
//   });
// });

// // JSHint linting
// gulp.task('lint', ['nodev'], function () {
//   return gulp.src(['src/**/*.js', 'spike/**/*.js', '*.js'])
//     .pipe(jshint())
//     .pipe(jshint.reporter(stylish));
// });

// // Run tests
// gulp.task('testNode', ['nodev', 'testdir'], function () {
//   return gulp.src(NODE_TEST_FILES).pipe(mocha({ reporter: 'spec'}));
// });

// gulp.task('testClient', ['nodev', 'testdir'], function (done) {
//   var browserTest = new karma.Server({
//     configFile: __dirname + '/karma.conf.js',
//     singleRun: true
//   }, done);
//   browserTest.start();
// });

// gulp.task('test', ['testNode', 'testClient']);

// gulp.task('default', ['lint', 'test']);

// gulp.task('integrate', ['default'], function () {
//   console.log('Integration step goes here');
// });

// gulp.task('watch', function () {
//   var browserTestWatcher = new karma.Server({
//     configFile: __dirname + '/karma.conf.js',
//   });
//   browserTestWatcher.start();
//   gulp.watch(CLIENT_FILES, ['lint']);
//   gulp.watch(NODE_FILES, ['lint', 'testNode']);
// });
