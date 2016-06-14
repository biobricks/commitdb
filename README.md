[![NPM][npm-img]][npm-url]
[![Build Status][ci-img]][ci-url]

NOTE: We do not yet consider this production-ready code.

CommitDB keeps track of commit history for a single project/entity.

CommitDB allows multiple heads (it does not force you to merge heads), but allows only one tail.

CommitDB only tracks metadata. The actual data should be stored elsewhere. See [pastlevel](https://github.com/biobricks/pastlevel) for an example.

CommitDB uses atomic commits so the commit database will always be consistent. headStreams are pinned to commit history as it looked when the stream was created, however, prevStreams and nextStreams are not. E.g: If you are using a nextStream and someone creates a new commit at the head before you reach the head then this new commit will be emitted by the nextStream. Also, if someone creates a new commit, changing the head, while you're trying to merge all heads, you will end up having merged the old heads.

# Usage

This example shows a commit history which forks into two heads and then merges those heads back into a single head.

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
  cache: true, // heads and tails are cached by default
  check: true // check if prev(s) actually exist when comitting
});
```

If you have multiple processes accessing the same CommitDB (e.g. using level-party) then you should turn caching off.

If you open an existing CommitDB and want to use caching then you should probably call either db.checkout or db.updateCache after instantiating your CommitDB to fill the cache. You don't have to do this, but some types of synchronous calling depend on the cache (sync calls to e.g. db.tail and db.heads) and will fail if the cache is empty. If you exclusively use async calls then don't worry about it.

## .checkout

Used to check out a commit. 

CommitDB remembers which commit was previously checked out, even after closing and re-opening the database. If called with no arguments (other than callback) then the remembered commit will be checked out again. This is probably the first function you want to call immediately after initializing a CommitDB instance based on an existing database.

Check out remembered commit:

```
db.checkout(function(err, id, obj) {
  if(err) return console.error(err);
  // if no remembered commit exists then both err and obj will be null
  console.log("Checked out commit:", id);
});
```

or check out a specified commit:

```
db.checkout(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a', {
    fetch: true, // set to false don't fetch commit and skip check if commit exists
    remember: true // don't remember that this was checked out
  }, function(err, id, obj) {
    if(err) return console.error(err);

    console.log("checked out commit:", id);
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
    check: <inherited from commitdb opts>, // check if prev(s) actually exist
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

```
db.prev(
  'f8b97d1adb133bac5658e076f3db2f6c2d91040830af8a0f0a9fc0ef13df850a',
  {
    idOnly: false // only get the prev id(s) instead of commit object(s)
  }, function(err, obj) {
    if(err) console.error(err);
    console.log("Fetched previous commit:", obj.id);
  });
});
```

Call with no commit id in order to get the prev from the currently checked out commit.

## .next

Get the next commit(s).

Same usage as .prev

## .prevStream

Stream commit objects going backwards in commit history.

```
var stream = db.prevStream(id, {
  idOnly: false, // only emit IDs of commits
  preventDoubles: true, // prevent the same key from being streamed twice
  skipCurrent: true // don't output the current commit (start with the prev)
});

stream.on('error', function(err) {
  console.error(err);
});

stream.on('data', function(obj) {
  console.log("Commit object:", obj.id);
});

stream.on('end', function() {
  console.log("reached end of commit history");
});
```

If no commmit id is specified then currently checked out commit will be used.

If the stream encounters commits with multiple prevs (signifying a merge) then the stream will continue along all possible paths back in history and emit all commit objects. 

If the commit history is very long and preventDoubles is not turned off then performance may degrade since a simply hash is used to prevent the same commits from being emitted twice.

## .nextStream

Same as .prevStream except streams commit history in forward direction.

## .headStream

Stream head ids:

```
var stream = db.headStream();
stream.on('data', function(id) {
  console.log("head:", id);
});
```

## .heads

Get array of heads ids:

```
db.heads(function(err, headIDs) {
  if(err) return console.error(err);

  console.log("head ids:", heads.join(', '));
});
```

## .tail

Get tail id:

```
db.tail(function(err, tailID) {
  if(err) return console.error(err);

  console.log("tail:", tailID);
});
```

## .automerge (not implemented!)

ToDo (not implemented)

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

This module _really_ needs some more tests.

* write better tests
* implement delete/destroy?
* implement tags
* implement named branches
* implement counts
* implement hooks
* implement "hydra: false" to disallow multiple heads
* implement automerge function and constructor opt
* implement rewrite (change the contents of a commit)


## about rewrites

Rewrites will need their own (single-headed) DAG separate from commit history. Resolving merge conflicts on this DAG will have to be done simplistically, e.g. using commit time (which might be wrong and if it's set far in the future would make things annoying). This same DAG could also be used for tagging and naming braches.

We need a separate DAG for this because: What happens if someone rewrites an old commit and that rewrite gets pushed to one head/branch and then someone rewrites the same commit on a different branch? It doesn't really make sense. Better 

It may be that allowing rewrites is a terrible idea. This library is different from git in that it is expected to be used in scenarios where many repos have continuous replications between each-other. The expectation is that you're never going to be doing something like a git-rebase as it would break anything. In this scenario you can't ever ask everyone to delete their copy and clone the repo again. What happens if you e.g. accidentally dox someone in a commit? It's already "pushed" to all the other servers. Rewrites allows this mistake to be fixed. Allowing rewrites means that someone malicious could potentially delete all data in all copies of a repo :/

## Test cases

* fork and merge
* prev and next / multiple prevs multiple nexts
* revert
* checks: isHeads, isTail, etc.
* remember last checkout
* Test caching on/off

# Hooks

ToDo not implemented

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
  'Grunkle': 7, // Grunkle has 7 commits
  'Cookie Cat': 42 // Cookie Cat has 42 commits
}
```

# Copyright and license

Copyright 2015-2016 BioBricks Foundation

License AGPLv3

[ci-img]: https://travis-ci.org/biobricks/commitdb.svg?branch=master
[ci-url]: https://travis-ci.org/biobricks/commitdb
[npm-img]: https://nodei.co/npm/commitdb.png
[npm-url]: https://nodei.co/npm/commitdb/