#!/usr/bin/env nodejs

var async = require('async');
var levelup = require('levelup');
var commitdb = require('../index.js');

var rawdb = levelup('/tmp/foodb');

var db = commitdb(rawdb, {
    cache: true
});

var a = [
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

async.eachSeries(a, function(o, cb) {
    db.commit(o, cb);
}, function(err) {
   if(err) return console.error("Error:", err);

    console.log("Success");

    db.heads(function(err, heads) {
        console.log("Heads:", heads);
    });

    db.tail(function(err, tail) {
        console.log("Tail:", tail);
    });
    
    var s = db.prevStream({
        idOnly: true
    });
    s.on('data', function(data) {
        console.log(data);
    });
    s.on('end', function() {
        console.log("Ended");
    });
    s.on('error', function(err) {
        console.error("Error", err);
    })
});



