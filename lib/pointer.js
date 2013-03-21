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
	var eventer = new events.EventEmitter();

	var stats = obj.stats;
	var type = obj.type;

	var name = path.basename(obj.filePath);
	var ext = path.extname(name);
	ext = ext.charAt(0) === '.' ? ext.substr(1) : '';
    var _path = path.resolve(obj.filePath);

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
					eventer.emit('error', err);
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
				eventer.on(event, callback);
			}
		},
		// Emit an event
		__emit: {
			value: function(){
				eventer.emit.apply(eventer, arguments);
			}
		},
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
			value: function () {
                if (!watcher) {
                    forwardEvents(fs.watch(self._path, {persistent: false}));
                }
			}
		}
	});

	// If configuration states start watching
	if (obj.watch) {
		self.__startWatch();
	}

	// Watcher is unstable, have to renew after each event
	var watcher = null;

	function forwardEvents(fsWatch) {
		watcher = fsWatch;
		['change', 'error'].forEach(function (ev) {
			fsWatch.on(ev, function () {
				fsWatch.close();
				self.__stats(true, function (err, _stats) {
					// file moved or renamed
					if (err) {
						eventer.emit('error');
						return;
					}
					// file changed
					if(!self._stats || self._stats.mtime !== _stats.mtime) {
						eventer.emit('change', _stats);
					}
					self._stats = _stats;
					self.__startWatch();
				});
			});
		});
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