
var levelup = require('levelup');
var temp = require('temp').track();
var commitdb = require('../index.js');
var test = require('tape');

var rawdb = levelup(temp.mkdirSync());

// test if an emptry commitdb behaves correctly

test('empty', function(t) {

    var db = commitdb(rawdb);
    if(!db) t.fail("constructor failed");

    t.plan(7);

    db.heads(function(err, heads) {
        if(err) return t.fail(".heads failed: " + err);
        t.equal(heads instanceof Array, true);
        t.equal(heads.length, 0);
        
        db.tail(function(err, tail) {
            if(err) return t.fail(".tail failed: " + err);
            t.equal(tail, null);
            t.equal(db.current(), null);

            db.checkout(function(err, id, obj) {
                if(err) return t.fail(".checkout failed: " + err);
                
                t.equal(obj, null);

                var s = db.prevStream();
                s.on('data', function(data) {
                    t.fail("empty commitdb prevStream should not have data");
                });
                s.on('end', function() {
                    t.pass("prevStream works");
                });
                
                var sn = db.nextStream();
                sn.on('data', function(data) {
                    t.fail("empty commitdb nextStream should not have data");
                });
                sn.on('end', function() {
                    t.pass("nextStream works");
                });

            });
        });
    });
});
