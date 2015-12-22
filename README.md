
NOTE: This is not yet production-ready code. Expect bugs and API changes.

commitdb keeps track of commit history for a single project/entity.

commitdb allows multiple heads (it does not force you to merge heads), but allows only one tail.

commitdb only tracks metadata. The actual data should be stored elsewhere.

# Usage

This example shows a simple commit history which forks into two heads and then merges those heads back into a single head.

```
var levelup = require('levelup');
var commitdb = require('commitdb');

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
```

# API



# ToDo

* write better tests
* implement counts
* implement hooks
* implement rewrite (change the contents of a commit)
a rewrite should add a new special "rewrite commit", since if it didn't then synchronization would be a pain

## Test cases

* What if prev/nextStream and skip current and no prev/next?
* Test caching on/off

# Hooks

## .on('pre-commit')

## .on('commit')

## .on('merge')

## .on('fork')

## .on('revert')

# Counts

Per default commitdb counts total number of commits and total number of heads.

You can tell commitdb to keep counts of other things in your meta-data like so:

```
var cdb = commitdb(db, {
  count: [
    'author.name',
    'comment.length'
  ]
});

// and to query

cdb.getCount('author.name', function(err, counts) {
  console.log(counts);
});

```

If the property being counted is a string, then a count for each unique string will be kept, e.g. the above example will about something like:

```
{
  'Bro Grammer': 7, // Bro Grammer has 7 commits
  'Cookie Cat': 42 // Cookie Cat has 42 commits
}
```

# Copyright and license

Copyright 2015 BioBricks Foundation

License AGPLv3