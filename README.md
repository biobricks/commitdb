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

* implement delete/destroy
* implement tags
* implement named branches
* implement counts
* implement hooks
* write better tests
* implement "hydra: false" to disallow multiple heads
* implement automerge function and constructor opt
* implement rewrite (change the contents of a commit)
a rewrite should add a new special "rewrite commit", since if it didn't then synchronization would be a pain

## Test cases

* fork and merge
* prev and next / multiple prevs multiple nexts
* revert
* checks: isHeads, isTail, etc.
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