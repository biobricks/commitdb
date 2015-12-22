#!/usr/bin/env nodejs

var levelup = require('levelup');
var commitdb = require('../index.js');

var rawdb = levelup('/tmp/foodb');
var db = commitdb(rawdb);

db.commit({
  foo: 1,
  comment: "Initial commit"
}, function(err, firstKey) {
  if(err) return cb(err);

  db.commit({
    foo: 2,
    comment: "Incremented foo"
  }, function(err, secondKey) {
    if(err) return cb(err);


    db.commit({
      bar: 3,
      comment: "Changed foo to bar and incremented"
    }, {
      prev: secondKey
    }, function(err, thirdKeyB) {
      if(err) return cb(err);

      db.commit({
        foo: 3,
        comment: "Incremented foo again"
      }, {
        prev: secondKey
      }, function(err, thirdKeyA) {
        if(err) return cb(err);

        // now we have two heads
        // let's try to merge all heads:

        db.merge({
          foobar: 3,
          comment: "Merge: Compromised on name"
        }, function(err, forthKey) {
          if(err) return cb(err);

          db.tail(function(err, tail) {
            console.log("tail:", tail);
          });

          db.heads(function(err, heads) {
            console.log("heads:", heads);
          });

          // stream commit history in backwards direction
          var s = db.prevStream({skipCurrent: false});

          s.on('data', function(data) {
            if(data.prev.length > 1) {
              console.log("Merge commit:", data.value);
            } else if(!data.prev || !data.prev.length) {
              console.log("Tail commit:", data.value);
            } else {
              console.log("Normal commit:", data.value);
            }
          });
        });
      });
    });
  });
});
