
IN PROGRESS! DO NOT EXPECT ANY OF THIS TO WORK!

commitdb is used for tracking the commit history of a single project/entity. 

commitdb allows multiple heads and does not force you to merge heads, but allows only one tail.

commitdb only tracks metadata. The actual data should be stored elsewhere. Since commitdb does not know about the data it does not use hashes, instead it uses v4 uuids.

# ToDo

* implement nextStream
* write better tests
* implement hooks
* implement counts
* implement rewrite (change the contents of a commit)


# Hooks

## .on('pre-commit')

## .on('commit')



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