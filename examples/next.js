#!/usr/bin/env nodejs

var async = require('async');
var levelup = require('levelup');
var commitdb = require('../index.js');

var rawdb = levelup('/tmp/foodb');

var db = commitdb(rawdb, {
    cache: true
});

var a = [
  {foo: 0},
  {foo: 1},
  {foo: 2},
  {foo: 3},
  {foo: 4},
  {foo: 5},
  {foo: 6},
  {foo: 7},
  {foo: 8},
  {foo: 9}
];

var b = [
  {bar: 3},
  {bar: 4},
  {bar: 5}
];

var commits = [];

async.eachSeries(a, function(o, cb) {
    db.commit(o, function(err, key) {
        if(err) return cb(err);
//        console.log(key);
        commits.push(key);
        cb();
    });
}, function(err) {
   if(err) return console.error("Error:", err);

    console.log("commits:", commits.length);

    // check out fourth commit
    db.checkout(commits[3], {fetch: false});

    async.eachSeries(b, function(o, cb) {
        db.commit(o, cb);
    }, function(err) {
        if(err) return console.error("Error:", err);

        db.commit({
            foo: 9,
            bar: 5
        }, {
            unify: true
        }, function(err, key) {

            console.log("done committing");
            
            db.heads(function(err, heads) {
                console.log("Heads:", heads);
            });
            
            db.tail(function(err, tail) {
                console.log("Tail:", tail);

                var s = db.nextStream(tail, {
                    idOnly: false,
                    skipCurrent: false
                });
                s.on('data', function(data) {
                    console.log(data.value);
                });
                s.on('end', function() {
                    console.log("Ended");
                });
                s.on('error', function(err) {
                    console.error("Error", err);
                });
            });
        });
    });
});


