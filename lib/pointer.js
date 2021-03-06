'use strict';

var fs = require('fs');
var path = require('path');
var utils = require('./utils');
var events = require('events');
var rimraf = require('rimraf');

function Pointer(obj) {
	if (!(this instanceof Pointer)) {
		return new Pointer(obj);
	}

	obj = utils.normalize(obj);

	var self = this;
    var watcher = null;
	var eventer = new events.EventEmitter();

	var stats = obj.stats;
	var type = obj.type;

	var name = path.basename(obj.filePath);
	var ext = path.extname(name);
	ext = ext.charAt(0) === '.' ? ext.substr(1) : '';
    var _path = path.resolve(obj.filePath);

    function emitError(err) {
        var event = err.code === 'ENOENT' ? 'missing' : 'error';
        if(eventer.listeners(event).length > 0) {
            eventer.emit(event, err);
        } else {
            console.log('FILE-POINTER ERROR:');
            console.log(err);
        }
    }

	Object.defineProperties(self, {
		// Pointer to parent if one exists
		_parent: {
			value: obj.parent,
			writable: true
		},
		// Absolute path
		_path: {
			value: _path
		},
		// Name of file
		_name: {
			value: name
		},
		// Name without extension
		_base: {
			value: ext === '' ? name : path.basename(_path, '.' + ext)
		},
		// Extension
		_ext: {
			value: ext
		},
		// file or directory
		_type: {
			get: function() { return type; },
            set: function(v) { type = v; },
			configurable: true
		},
		// Cached stats
		_stats: {
			get: function () { return stats;},
			set: function (s) {
                // file changed
                if(!stats || stats.mtime.getTime() !== s.mtime.getTime()) {
                    eventer.emit('change', s);
                }
				stats = s;
				if (stats) {
					var newType = stats.isDirectory() ? 'directory' : 'file';
					if(type !== newType) {
						self._type = newType;
						eventer.emit('transform', createObj(self));
					}
				}
			}
		},
		// Remove pointer from parent
		__remove: {
			value: function () {
				if (self._parent && self._parent.__removeChild) {
					return self._parent.__removeChild(self);
				}
				return;
			}
		},
		// Ask stats from filesystem or return cached stats
		__stats: {
			value: function (force, callback) {
				if (typeof force === 'function') {
					callback = force;
					force = false;
				}
				if (typeof callback !== 'function') {
					return self._stats;
				}
				if (!force && self._stats) {
					process.nextTick(function(){
						callback(null, self._stats);
					});
					return;
				}
				fs.stat(self._path, function (err, _stats) {
                    if (err) {
                        emitError(err);
                        callback(err);
                        return;
                    }
					self._stats = _stats;
					callback(err, _stats);
				});
			}
		},
		// Delete the file from filesystem
		__delete: {
			value: function (callback) {
				self.__stopWatch();

				callback = callback || function(err) {
					emitError(err);
				};

				function end(err){
					if (err) {
						callback(err);
						return;
					}
					callback(null, self.__remove());
				}

				rimraf(self._path, end);
			},
			configurable: true
		},
		// Register an event listener
		__listen: {
			value: function (event, callback) {
				return eventer.on(event, callback);
			}
		},
        __removeListener: {
            value: function (event, listener) {
                return eventer.removeListener(event, listener);
            }
        },
        __deconstruct: {
            value: function () {
                self.__remove();
                eventer.removeAllListeners();
                self.__stopWatch();
            }
        },
		// Emit an event
		__emit: {
			value: function(){
				return eventer.emit.apply(eventer, arguments);
			}
		}
	});

    // File watching

    Object.defineProperties(self, {
        // Stop watching file changes
        __stopWatch: {
            value: function () {
                if (watcher) {
                    watcher.close();
                    watcher = null;
                }
            }
        },
        // Start watching file changes
        __startWatch: {
            value: function (persistent) {
                if (!watcher) {
                    try {
                        watcher = fs.watch(self._path, {persistent: persistent ? true : false}, function (event) {
                            self.__stopWatch();
                            self.__stats(true, function (err) {
                                if(!err || err.code !== 'ENOENT') {
                                    self.__startWatch();
                                }
                            });
                        });
                    } catch(e) {
                        self.__emit('missing', e);
                        setTimeout(self.__deconstruct.bind(self), 60000); //Remove dead elements just in case
                    }
                }
            }
        }
    });

    // If configuration states start watching
    if (obj.watch) {
        self.__startWatch(obj.watch === 'persistent');
    }
}

function createObj(obj){
  var Const = null;
  var opts = utils.normalize(obj);

  switch (opts.type) {
    case 'directory':
      Const = require('./folder');
      break;
    case 'file':
      Const = require('./file');
      break;
    default:
      throw new TypeError('Unrecognized type');
      break;
  }
  return new Const(opts);
}

module.exports = Pointer;
Object.defineProperty(module.exports, 'Pointer', {value: Pointer});