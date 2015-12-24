
var levelup = require('levelup');
var temp = require('temp').track();
var commitdb = require('../index.js');
var test = require('tape');

var rawdb = levelup(temp.mkdirSync());

// basic usage: single commit followed by get

test('basic', function(t) {

    var db = commitdb(rawdb);
    if(!db) t.fail("constructor failed");

    t.plan(11);
    
    db.commit({
        foo: 1,
        comment: "Initial commit"
    }, function(err, id) {
        if(err) return t.fail("commit failed: " + err);
        
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
