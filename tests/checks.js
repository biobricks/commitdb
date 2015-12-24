
var levelup = require('levelup');
var temp = require('temp').track();
var commitdb = require('../index.js');
var test = require('tape');

var rawdb = levelup(temp.mkdirSync());

// test checks: isHead, isTail, isMerge, isFork, isRevert

/*
// build the repository
function buildRepo(t, db, cb) {
   db.commit({
        foo: 1
    }, function(err, firstID) {
        if(err) return t.fail("commit failed: " + err);
        db.commit({
            foo: 2
        }, function(err, secondID) {
            if(err) return t.fail("commit failed: " + err);
            db.commit({
                foo: 3
            }, function(err, thirdID) {
                if(err) return t.fail("commit failed: " + err);
                db.commit({
                    foo: 3b
                }, {
                    prevs: secondID
                }, function(err, id) {
                    if(err) return t.fail("commit failed: " + err);

                    db.merge
                });
            });
        });
    });
}


test('checks', function(t) {

    var db = commitdb(rawdb);
    if(!db) t.fail("constructor failed");

    t.plan(11);
    
    buildRepo(t, db, function() {
 
        t.equal(typeof id, 'string');
        t.equal(id.length, 64);
        
        db.get(id, function(err, obj) {
            if(err) return t.fail(".get failed: " + err);

            t.equal(typeof obj, 'object');
            t.equal(obj.prev instanceof Array, true);
            t.equal(obj.prev.length, 0);
            t.equal(obj.id, id);
            t.equal(obj.value.foo, 1);

            db.heads(function(err, heads) {
                if(err) return t.fail(".heads failed: " + err);
                t.equal(heads instanceof Array, true);
                t.equal(heads.length, 1);
                t.equal(heads[0], id);

                db.tail(function(err, tail) {
                    if(err) return t.fail(".tail failed: " + err);
                    t.equal(tail, id);
                });
            });
        });
    });
});
*/
