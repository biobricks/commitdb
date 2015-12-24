[![NPM][npm-img]][npm-url]
[![Build Status][ci-img]][ci-url]

NOTE: This is not yet production-ready code. Expect bugs and API changes.

CommitDB keeps track of commit history for a single project/entity.

CommitDB allows multiple heads (it does not force you to merge heads), but allows only one tail.

CommitDB only tracks metadata. The actual data should be stored elsewhere.

CommitDB uses atomic commits and streams are pinned to the commit history as it looked when the stream was created. The worst that can happen is if someone creates a new commit, changing the head, while you're trying to merge all heads: You will end up having merged the old heads. There is no way to avoid this if you're planning to use CommitDB in a decentralized setup. 

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
}, function(err, firstID) {
  if(err) return cb(err);

  db.commit({
    foo: 2,
    comment: "Incremented foo"
  }, function(err, secondID) {
    if(err) return cb(err);

    db.commit({
      bar: 3,
      comment: "Changed foo to bar and incremented"
    }, {
      prev: secondID
    }, function(err, thirdIDb) {
      if(err) return cb(err);

      db.commit({
        foo: 3,
        comment: "Incremented foo again"
      }, {
        prev: secondID
      }, function(err, thirdIDa) {
        if(err) return cb(err);

        // now we have two heads
        // let's try to merge all heads:

        db.merge({
          foobar: 3,
          comment: "Merge: Compromised on name"
        }, function(err, forthID) {
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

## _constructor_

```
var db = commitdb(levelup_instance, {
  cache: true // heads and tails are cached by default
});
```

If you have multiple processes accessing the same CommitDB (e.g. using level-party) then you should turn caching off.

If you open an existing CommitDB and want to use caching then you should probably call either db.checkout or db.updateCache after instantiating your CommitDB to fill the cache. You don't have to do this, but some types of synchronous calling depend on the cache (sync calls to e.g. db.tail and db.heads) and will fail if the cache is empty. If you exclusively use async calls then don't worry about it.

## .checkout

Used to check out a commit. 

CommitDB remembers which commit was previously checked out, even after closing and re-opening the database. If called with no arguments (other than callback) then the remembered commit will be checked out again. This is probably the first function you want to call immediately after initializing a CommitDB instance based on an existing database.

Check out remembered commit:

```
db.checkout(function(err, obj) {
  if(err) return console.error(err);
  // if no remembered commit exists then both err and obj will be null
  console.log("Checked out commit:", obj.id);
});
```

or check out a specified commit:

```
db.checkout(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a', {
    fetch: true, // set to false don't fetch commit and skip check if commit exists
    remember: true // don't remember that this was checked out
  }, function(err, obj) {
    if(err) return console.error(err);

    console.log("checked out commit:", commit.id);
})
```

If the CommitDB instance was initialized with cache: true and the cache is uninitialized when checkout is called then the cache will be initialized.

If fetch is false then the commit object will not be passed to the callback. Can be called synchronously if both fetch and remember are set to false.

## .current (sync)

Synchronously return the currently checked out commit id:

```
var id = db.current();
console.log("Checked out revision:", id);
```

## .commit

Simple usage:

```
// make a commit with the currently checked out commit as previous (parent)
// or if no commit is checked out and no tail present then commit as tail
// and check out what you committed
db.commit({
    cookie: 'cat' // you can commit any JSON serializable value
  }, function(err, id, doc) {
    if(err) return console.error("error:", err);

    console.log("committed as:", id);
    console.log("checked out commit is:", db.current());
});
```

Specified prev (parent) commit:

```
db.commit({
    cookie: 'cat' // you can commit any JSON serializable value
  }, 
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  function(err, id, doc) {
    if(err) return console.error("error:", err);

    console.log("committed as:", id);
});
```

All options:

```
db.commit({
    cookie: 'cat' // you can commit any JSON serializable value
  }, {
    prev: [], // specify one or more prevs (parents) for the commit
    unify: false, // if true, this commit uses all current heads as prev
    stay: false, // if true then commit won't check out the current commit
    id: undefined, // override the id generated by commitdb with your own
    meta: undefined // object of extra properties to store in meta-data
  }, function(err, id, doc) {
    if(err) return console.error("error:", err);

    console.log("committed as:", id);
  });
```

Specifying an array of prevs results in a merge. If there are currently multiple heads then specifying unify: true also results in a merge.

## .merge

.commit can do everything .merge can do, this is just syntactic sugar.

Merge all heads:

```
db.merge({
    cookie: 'cat' // you can commit any JSON serializable value
}, function(err, id, doc) {
  if(err) return console.error("error:", err);

  console.log("committed as:", id);
});
```

## .get

Retrieve a commit object based on id:

```
db.get(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  function(err, obj) {
    if(err) console.error(err);
    console.log("Fetched commit with id:", obj.id);
});
```

## .prev

Get the previous commit(s).

## .next

## .prevStream

## .nextStream

## .headStream

## .heads

## .tail

## .automerge (not implemented!)

ToDo

Automatically merge array of prevs or all heads using the specified strategy.

## .revert 

Create a new commit that reverts to a previous commit. Takes the same options as db.commit but takes a single commit id as first argument instead of a value. The resulting commit will have the property .revertedFrom set to the id of the commit from which you reverted.

```
db.revert(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  function(err, id, doc) {
    if(err) return console.error("error:", err);

    console.log("reverted from", doc.revertedFrom, "as commit", id);
});
```

## .isFork 

Check if a commit is a fork (multiple other commits have it as their prev).

```
db.isFork(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  function(err, isFork) {
    console.log("is it a fork:", isFork);
});
```

db.isFork can be called with a commit object instead of a commit id or with no commit at all in which case the currently checked out commit is used.

## .isTail

Check if a commit is the tail (it has no prevs)

```
// check if a commit is a tail based on its commit ID
db.isTail(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  function(err, isTail) {
    if(err) return console.error("error:", err);

    console.log("is it the tail:", isTail);
});

// check if currently checked out commit is the tail
db.isTail(function(err, isTail) {
  if(err) return console.error("error:", err);

  console.log("do we have the tail checked out:", isTail);
});
```

The commit can be a commit ID or a commit object or unspecified in which case the currently checked out commit is used (if any).

db.isTail can optionally be called synchronously if you either supply a commit object instead of just the commit ID _or_ if you have caching enabled and the tail is currently cached:

```
var isTail;

// sync calling with cache
console.log("is tail checked out:", db.isTail());


// sync calling without cache needs the commit object
db.get(function(err, obj) { // get currently checked out commit object
  if(err) return console.error("error:", err);

  console.log("is tail checked out", db.isTail(obj);
});
```

## .isHead

Check if a commit is a head (no other commits have it as their prev).

You can optionally call isHead synchronously if cache is on. Usage is the same as for .isTail

## .isMerge

Check if a commit is a merge (it has multiple prevs)

You can optionally call isMerge synchronously if you supply a commit object instead of a commit id. 

Usage is the same as .isTail

## .isRevert

Check if a commit is a revert from a previous commit.

You can optionally call isMerge synchronously if you supply a commit object instead of a commit id. 

Usage is the same as .isTail except that if the commit _is_ a revert then .isRevert returns the commit id of the commit that was reverted from.

## .db (property)

The underlying levelup instance.

# ToDo

* implement counts
* implement hooks
* write better tests
* implement "hydra: false" to disallow multiple heads
* implement automerge function and constructor opt
* implement rewrite (change the contents of a commit)
a rewrite should add a new special "rewrite commit", since if it didn't then synchronization would be a pain

## Test cases

* fork and merge
* revert
* checks
* remember last checkout
* Test caching on/off

# Hooks

## .on('pre-commit')

## .on('commit')

## .on('merge')

## .on('fork')

## .on('revert')

# Counts

Per default CommitDB counts total number of commits and total number of heads.

You can tell CommitDB to keep counts of other things in your meta-data like so:

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

[ci-img]: https://travis-ci.org/biobricks/commitdb.svg?branch=master
[ci-url]: https://travis-ci.org/biobricks/commitdb
[npm-img]: https://nodei.co/npm/commitdb.png
[npm-url]: https://nodei.co/npm/commitdb/