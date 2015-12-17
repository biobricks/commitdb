
var util = require('util');
var xtend = require('xtend');
var uuid = require('uuid').v4;
var from = require('from2');
var defaults = require('levelup-defaults');
var bytewise = require('bytewise');
var EventEmitter = require('events').EventEmitter;

function CommitDB(db, opts) {
    if(!(this instanceof CommitDB)) return new CommitDB(db, opts);
    EventEmitter.call(this);

    this.opts = xtend(opts || {}, {
        cache: true // you can turn off caching of heads and tail
    });
    if(!this.opts.count) {
        this.opts.count = [];
    }

    this.tailCache = null; // cache tail
    this.headCache = null; // cache current heads;

    this.db = defaults(db, {
        keyEncoding: bytewise, 
        valueEncoding: 'json'
    });

/*
    this.cdb = sublevel(this.db, 'c'); // actual commits
    this.hdb = sublevel(this.db, 'h'); // heads
    this.rdb = sublevel(this.db, 'r'); // reverse history index
    this.vdb = sublevel(this.db, 'v'); // one-off values like commit-count 
*/

    this.cur = null; // currently checked out commit

}

util.inherits(CommitDB, EventEmitter);

CommitDB.prototype.commit = function(value, opts, cb) {
    if(!cb && typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    opts = xtend({
        prev: [], // use prev as parent, rather than this.cur (can be array)
        unify: false, // if true, this commit uses all current heads as prev
        stay: false // if true then commit won't check out the current commit
    }, opts || {});
 
    if(opts.unify) {
        this.heads(function(err, heads) {
            if(err) return cb(err);
            delete opts.unify
            opts.prev = heads;
            this._commit(value, opts, cb);
        });
    } else {
        if(!opts.prev || !opts.prev.length) {
            if(this.cur) {
                opts.prev = [this.cur];
            }
        }
        if(!opts.prev || !opts.prev.length) {
            // sanity check
            // is user trying to add a tail to something that has a tail?
            this.tail(function(err, key) {
                if(err) return cb(err);
                if(key) return cb(new Error("Trying to add commit with no parent to a commitdb that already has a tail. Either check out an existing commit before committing or explicity specify opts.prev or set opts.unify to true"));
                this._commit(value, opts, cb);
            }.bind(this));
        } else {
            this._commit(value, opts, cb);
        }
    }
};

// actually commit
CommitDB.prototype._commit = function(value, opts, cb) {

    var meta = {
        time: Date.now()
    };
    if(opts.prev) {
        meta.prev = opts.prev;
    } else {
        opts.prev = [];
    }

    var key = uuid();
    var doc = {meta: meta, value: value};

    var ops = []
    // add the commit
    ops.push({type: 'put', key: ['c', key], value: doc});

    // remove the commit's prevs as heads
    var i;
    for(i=0; i < opts.prev.length; i++) {
        ops.push({type: 'del', key: ['h', opts.prev[i]]});
    }
    // add the commit as a head
    ops.push({type: 'put', key: ['h', key], value: null});

    // if this is the tail then write it
    if(!opts.prev || !opts.prev.length) {
        ops.push({type: 'put', key: 'tail', value: key});
    }

    this.db.batch(ops, function(err) {
        if(err) return cb(err);
        // success! update the caches
        for(i=0; i < opts.prev.length; i++) {
            delete this.headCache[opts.prev[i]];
        } 
        if(!this.headCache) this.headCache = {};
        this.headCache[key] = true;
        if(!opts.prev || !opts.prev.length) {
            this.tailCache = key;
        }
        if(!opts.stay) {
            this.cur = key;
        }
        cb(null, key, meta);
    }.bind(this));
};

// delete a commit
CommitDB.prototype.del = function(key, opts) {
    if(typeof key === 'object') {
        opts = key;
        key = null;
    }
    opts = xtend({
        recursive: false // delete a non-head commit and all its children
    }, opts || {});

    // ToDo implement
};

// retrieve stored counts
CommitDB.prototype.getCount = function(key, cb) {

};

// stream of previous commits, starting at current commit
// (or starting at current checked out commit if not specified)
CommitDB.prototype.prevStream = function(commit, opts) {
    opts = xtend({
        preventDoubles: true // prevent the same 
    }, opts || {});
    commit = commit || this.cur;
    if(!commit) throw new Error("prevStream needs a commit as a starting point");

    var queue = [commit];

    var self = this;
    function getCommit(commit, cb) {
        self.db.get(['c', commit], function(err, data) {
            if(err) {
                if(!err.notFound) return cb(err);
                return cb(new Error("commit "+commit+" not found"));
            }

            if(!data || !data.meta) {
                return cb(new Error("encountered invalid commit"));
            }

            queue = queue.concat(data.meta.prev);
            data.meta.commit = commit;
            cb(null, data);
        });
    }


    return from.obj(function(size, next) {
        if(queue.length) {
            getCommit(queue.shift(), next);
        } else {
            next(null, null);
        }
    });
}

// stream of next commits, starting at current commit
// (or starting at current checked out commit if not specified)
CommitDB.prototype.nextStream = function(commit) {

}

// stream of heads
CommitDB.prototype.headStream = function() {
    return this.db.createReadStream({
        gt: ['h'],
        lt: ['h\uffff']
    });
}

// get array of current heads
CommitDB.prototype.heads = function(cb) {
    if(this.headCache && this.opts.cache) {
        process.nextTick(function() {
            cb(null, Object.keys(this.headCache));
        }.bind(this));
    } else {
        this.headCache = [];
        var cbCalled = 0;
        var s = this.headStream();
        var key;
        s.on('data', function(data) {
            key = data.key[1];
            this.headCache[key] = true;
        }.bind(this));
           
        s.on('end', function() {
            if(cbCalled++) return;
            cb(null, Object.keys(this.headCache));
        }.bind(this));

        s.on('error', function(err) {
            if(cbCalled++) return;
            cb(err);
        });
    }
}

// get the tail
CommitDB.prototype.tail = function(cb) {
    if(this.tailCache && this.opts.cache) {
        process.nextTick(function() {
            cb(null, this.tailCache);
        }.bind(this));   
    } else {
        this.db.get('tail', function(err, data) {
            if(err) {
                if(!err.notFound) {
                    return cb(err);
                } else {
                    return cb(null, null);
                }
            }
            cb(null, data.key);
        });
    }
}

CommitDB.prototype.rawStream = function() {
  return this.db.createReadStream();
}

module.exports = CommitDB;
