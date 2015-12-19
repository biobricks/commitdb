
var util = require('util');
var xtend = require('xtend');
var uuid = require('uuid').v4;
var async = require('async');
var from = require('from2');
var defaults = require('levelup-defaults');
var bytewise = require('bytewise');
var EventEmitter = require('events').EventEmitter;

function NotFoundError(message) {
    this.name = "NotFoundError";
    this.message = (message || "Not Found");
    this.notFound = true;
}
NotFoundError.prototype = Error.prototype;


function CommitDB(db, opts) {
    if(!(this instanceof CommitDB)) return new CommitDB(db, opts);
    EventEmitter.call(this);

    this.opts = xtend(opts || {}, {
        cache: true, // you can turn off caching of heads and tail
        hydra: true // turn off to disallow multiple heads ToDo
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
        stay: false, // if true then commit won't check out the current commit
        id: undefined, // you can supply your own commit id (e.g. use a hash)
        meta: undefined // object of properties to store in meta-data
    }, opts || {});

    var self = this;
    if(opts.unify) {
        this.heads(function(err, heads) {
            if(err) return cb(err);
            delete opts.unify
            opts.prev = heads;
            self._commit(value, opts, cb);
        });
    } else {
        if(!opts.prev || !opts.prev.length) {
            if(this.cur) {
                opts.prev = [this.cur];
            }
        }
        if(typeof opts.prev === 'string') {
            opts.prev = [opts.prev];
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

    var doc = {
        time: Date.now()
    };
    if(opts.prev) {
        doc.prev = opts.prev;
    } else {
        opts.prev = [];
    }

    if(typeof opts.meta === 'object') {
        var reserved = ['prev', 'time'];
        var k;
        for(k in opts.meta) {
            if(reserved.indexOf(k) > -1) continue;
            doc[k] = opts.meta[k];
        }
    }

    var key = opts.id || uuid();
    doc.value = value;

    var isTail = false;
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
        isTail = true;
    }

    this.db.batch(ops, function(err) {
        if(err) return cb(err);
        // success! update the caches
        for(i=0; i < opts.prev.length; i++) {
            delete this.headCache[opts.prev[i]];
        } 
        if(!this.headCache) this.headCache = {};
        this.headCache[key] = true;
        if(!opts.stay) {
            this.cur = key;
        }
        if(isTail) {
            this.tailCache = key;
            cb(null, key, doc);
        } else {
            // if this is not the tail then add a nextIndex
            this._addNextIndexes(opts.prev, key, function(err) {
                if(err) return cb(err);
                cb(null, key, doc);
            });
        }
    }.bind(this));
};

// just some syntactic sugar for merging
// calling without any prevs merges all heads
CommitDB.prototype.merge = function(value, prevs, cb) {
    var opts = {};
    if(typeof prevs === 'function') {
        cb = prevs;
        opts.unify = true;
    } else {
        opts.prevs = prevs;
    }
    this.commit(value, opts, cb);
}

// Revert to an old commit
// This just creates a new commit with the value of the old commit
// and marks the new commit as a revert from the old commit
// by setting .revertedFrom to the id of the previous commit
// takes the same opts as .commit
CommitDB.prototype.revert = function(toCommit, opts, cb) {
    if(typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    opts.meta = opts.meta || {};
    opts.meta.revertedFrom = toCommit;

    this._get(toCommit, function(err, doc) {
        if(err) return cb(err);
        this.commit(doc.value, opts, cb);
    });
}

// is this commit a merge?
// (does it have multiple prevs)
CommitDB.prototype.isMerge = function(commit, cb) {
 // ToDo
}

// is this commit a fork?
// (does it have multiple nexts)
CommitDB.prototype.isFork = function(commit, cb) {
 // ToDo
}

// is this commit a head?
CommitDB.prototype.isHead = function(commit, cb) {
 // ToDo
}

// is this commit the tail?
// (does it not have any prevs?)
// this function can be used as sync if you pass a commit object
// rather than a commit id
CommitDB.prototype.isTail = function(commit, cb) {
    if(typeof commit === 'function') {
        cb = commit;
        commit = null;
    }
    commit = commit || this.cur;
    if(!commit) {
        var err = new Error("You must either check out a commit or supply a commit id");
        if(cb) return cb(err);
        throw err;
    }
    return this._isTail(commit, cb);
}

CommitDB.prototype._isTail = function(commit, cb) {
    if(typeof commit === 'string') {
        if(!cb) throw new Error("You must use a commit object, not a commit id, as argument if you plan to call this function synchronously");
        this._get(commit, function(err, commit) {
            if(err) return cb(err);
            if(!commit.prev || !commit.prev.length) {
                cb(null, true);
            } else {
                cb(null, false);
            }
        });
    } else {
        var ret;
        if(!commit.prev || !commit.prev.length) {
            ret = true;
        } else {
            ret = false;
        }
        if(cb) {
            process.nextTick(function() {cb(null, ret)});
        } else {
            return ret;
        }
    }
}

// add an entry to the nextIndex 
// (the nextIndex let's you look up the children of a parent commit)
CommitDB.prototype._addNextIndex = function(parent, child, cb) {
    var key = ['n', parent];
    var children;
    var self = this;
    this.db.get(key, function(err, data) {
        if(err) {
            if(!err.notFound) return cb(err);
            children = [child];
        } else {
            children = data;
            children.push(child);
        }
        self.db.put(key, children, function(err) {
            if(err) return cb(err);
            cb(null, children);
        });
    });
};

CommitDB.prototype._addNextIndexes = function(parents, child, cb) {
    var self = this;
    async.eachSeries(parents, function(parent, cb) {
        self._addNextIndex(parent, child, cb);
    }, function(err) {
        if(err) return cb(err);
        cb(null);
    });
}

// delete a commit
CommitDB.prototype.del = function(key, opts) {
    if(typeof key === 'object') {
        opts = key;
        key = null;
    }
    opts = xtend({
        recursive: false // delete a non-head commit and all its children
    }, opts || {});

    throw new Error("unimplemented");
    // ToDo implement
};

// get a commit
CommitDB.prototype.get = function(key, cb) {
    if(typeof key === 'function') {
        cb = key;
        key = this.cur;
    }
    if(!key) return cb(new Error("Either specify or check out a commit"));
    this._get(key, cb);
};

CommitDB.prototype._get = function(key, cb) {
    this.db.get(['c', key], function(err, data) {
        if(err) {
            if(err.notFound) return cb(new NotFoundError("No such commit: " + key));
            return cb(err);
        }
        if(!data) {
            return cb(new Error("Encountered invalid commit: " + key));
        }
        cb(null, data);
    });
};

// check out a commit
CommitDB.prototype.checkout = function(key, opts, cb) {
    if(typeof opts === 'function') {
        cb = opts;
        opts = null;
    }
    opts = xtend({
        verify: true // check if commit exists and return commit
    }, opts || {});
    if(!key) {
        return cb(new Error("You must specify which commit to check out"));
    }
    this._checkout(key, opts, cb);
}

CommitDB.prototype._checkout = function(key, opts, cb) {
    if(!opts.verify) {
        this.cur = key;
        if(cb) cb(null);
        return;
    }
    this._get(key, function(err, data) {
        if(err) return cb(err);
        this.cur = key;
        cb(null, data);
    });
}


// get prev commit(s) (from current checkout or specified commit)
CommitDB.prototype.prev = function(key, cb) {
    if(typeof key === 'function') {
        cb = key;
        key = this.cur;
    } else if(typeof key === 'object' && key.prev) {
        return this.get(key.prev, cb);
    };
    if(!key) return cb(new Error("Either specify or check out a commit"));
    this._prev(key, cb);
};

CommitDB.prototype._prev = function(key, cb) {
    var self = this;
    this._get(key, function(err, data) {
        if(err) return cb(err);
        if(!data.prev || !data.prev.length) {
            return cb(new Error("There is no previous commit. This must be the tail."));
        }
        var prevs = [];
        async.eachSeries(data.prev, function(prev) {
            self._get(prev, function(err, data) {
                if(err) return cb(err);
                prevs.push(data);
            });
        }, function(err) {
            if(err) return cb(err);
            cb(null, prevs);
        });

    });
};

// get next commit(s) (from current checkout or specified commit)
CommitDB.prototype.next = function(key, cb) {
    if(typeof key === 'function') {
        cb = key;
        key = this.cur;
    }
    if(!key) return cb(new Error("Either specify or check out a commit"));
    this._next(key, cb);
};

CommitDB.prototype._next = function(key, cb) {
    var self = this;
    this._nextKeys(key, function(err, nextKeys) {
        if(err) return cb(err);
        var commits = [];
        async.eachSeries(nextKeys, function(nextKey) {
            self.db.get(nextKey, function(err, data) {
                if(err) return cb(err);
                commits.push(data);
            });
        }, function(err) {
            if(err) return cb(err);
            cb(null, commits);
        });
    });
};

// get keys of next commit(s)
CommitDB.prototype.nextKeys = function(key, cb) {
    if(typeof key === 'function') {
        cb = key;
        key = this.cur;
    }
    this._nextKeys(key, cb);    
};

// get keys of next commit(s)
CommitDB.prototype._nextKeys = function(key, cb) {
    this.db.get(['n', key], function(err, nextKeys) {
        if(err) {
            if(err.notFound) return cb(new Error("There is no next commit. Commit must be a head."));
            return cb(err);
        }
        cb(null, nextKeys);
    });
};

// retrieve stored counts
CommitDB.prototype.getCount = function(key, cb) {

};

// stream of previous commits
CommitDB.prototype.prevStream = function(commit, opts) {
    if(typeof commit === 'object') {
        opts = commit;
        commit = null;
    }

    opts = xtend({
        preventDoubles: true, // prevent the same key from being streamed twice
        idOnly: false // only output IDs of commits
    }, opts || {});

    commit = commit || this.cur;
    if(!commit) throw new Error("prevStream needs a commit as a starting point");
    return this._prevStream(commit, opts);
};


CommitDB.prototype._prevStream = function(commit, opts) {

    var keys = {}; // already processed keys
    var queue = [commit];

    var i;
    var self = this;
    function getPrevs(c, cb) {
        self._get(c, function(err, data) {
            if(err) return cb(err);
            if(opts.preventDoubles) {
                for(i=0; i < data.prev.length; i++) {
                    if(keys[data.prev[i]]) continue;
                    keys[data.prev[i]] = true;
                    queue.push(data.prev[i]);
                }
            } else {
                queue = queue.concat(data.prev);
            }
            // skip the current commit
            if(c === commit) {
                return getPrevs(queue.shift(), cb);
            }
            data.commit = c;
            cb(null, data, c);
        });
    }

    return from.obj(function(size, next) {
        if(queue.length) {
            getPrevs(queue.shift(), function(err, data, c) {
                if(err) return next(err);
                if(opts.idOnly) {
                    next(null, c);
                } else {
                    next(null, data);
                }
            });
        } else {
            next(null, null);
        }
    });
}

// stream of next commits
CommitDB.prototype.nextStream = function(commit) {
    opts = xtend({
        preventDoubles: true // prevent the same key from being streamed twice
    }, opts || {});
    commit = commit || this.cur;
    if(!commit) throw new Error("prevStream needs a commit as a starting point");

    var keys = {}; // already processed keys
    var queue = [commit];

    var i;
    var self = this;
    function getCommit(commit, cb) {
        self._get(commit, function(err, data) {
            if(opts.preventDoubles) {
                for(i=0; i < data.prev.length; i++) {
                    if(keys[data.prev[i]]) continue;
                    keys[data.prev[i]] = true;
                    queue.push(data.prev[i]);
                }
            } else {
                queue = queue.concat(data.prev);
            }

            data.commit = commit;
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
