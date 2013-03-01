'use strict';

var fs = require('fs');
var path = require('path');
var events = require('events');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');

function Pointer(obj) {
	if (this instanceof Pointer !== true) {
		return new Pointer(obj);
	}
	obj = normalize(obj);

	var self = this;
	var eventer = new events.EventEmitter();

	var stats = obj.stats;
	var type = obj.type;

	var name = path.basename(obj.filePath);
	var ext = path.extname(name);
	ext = ext.charAt(0) === '.' ? ext.substr(1) : '';

	Object.defineProperties(self, {
		_parent: {
			value: obj.parent,
			writable: true
		},
		_path: {
			value: path.resolve(obj.filePath)
		},
		_name: {
			value: name
		},
		_base: {
			value: ext === '' ? name : path.basename(self._path, '.' + ext)
		},
		_ext: {
			value: ext
		},
		_type: {
			get: function() { return type; },
			configurable: true
		},
		_stats: {
			get: function () { return stats;},
			set: function (s) {
				stats = s;
				var newType = stats.isDirectory() ? 'directory' : 'file';
				if(type !== newType) {
					type = newType;
					eventer.emit('transform', createObj(self));
				}
			}
		},
		__remove: {
			value: function () {
				if (self._parent && self._parent.__removeChild) {
					return self._parent.__removeChild(self);
				}
				return;
			}
		},
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
		__listen: {
			value: function (event, callback) {
				eventer.on(event, callback);
			}
		},
		__emit: {
			value: function(){
				eventer.emit.apply(eventer, arguments);
			}
		},
		__stopWatch: {
			value: function () {
				if (watcher) {
					watcher.close();
				}
			}
		},
		__startWatch: {
			value: function () {
				forwardEvents(fs.watch(self._path, {persistent: false}));
			}
		}
	});
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

function File(obj) {
	if (this instanceof File !== true) {
		return new File(obj);
	}

	obj = normalize(obj);

	var self = this;
	var pointer = obj.pointer || new Pointer(obj);

	Object.getOwnPropertyNames(pointer).forEach(function (prop) {
		Object.defineProperty(self, prop, Object.getOwnPropertyDescriptor(pointer, prop));
	});

	Object.defineProperties(self, {
		_type: {
			value: 'file'
		},
		__read: {
			value: function (callback) {
				if (callback) {
					fs.readFile(filePath, 'utf8', callback);
					return;
				}
				return fs.createReadStream(filePath);
			}
		},
		__write: {
			value: function (content, callback) {
				if (content === undefined && callback === undefined) {
					return fs.createWriteStream(self._path);
				}
				if (typeof content !== 'string') {
					throw new TypeError('Content must be string');
				}
				callback = callback || function (err) {
					if (err) {
						pointer.__emit('error', err);
					}
				};
				fs.writeFile(self._path, content, callback);
			}
		},
		__delete: {
			value: function (force, callback) {
				if (force instanceof Function) {
					callback = force;
					force = false;
				}

				pointer.__stopWatch();

				callback = callback || function (err) {
					if (err) {
						pointer.__emit('error', err);
					}
				};

				function end(err) {
					if (err) {
						callback(err);
						return;
					}
					callback(null, self.__remove());
				}

				var func = force ? rimraf : fs.unlink;
				func(self._path, end);
			}
		}
	});
}

Object.defineProperty(File, '__create', {
	value: function(filePath, content, force, callback) {
		if(typeof force === 'function') {
			callback = force;
			force = false;
		}


		function createFile(again) {
			fs.writeFile(filePath, content, 'utf8', function(err){
				if(err) {
					if(!again) {
						callback(err);
						return;
					}
					Folder.__create(path.dirname(filePath), true, function (err) {
						if(err) {
							callback(err);
							return;
						}
						createFile(false);
					});
					return;
				}
				var f = new File(filePath);
				callback(null, f);
			});
		}

		createFile(force);
	}
});

function Folder(obj) {
	if (this instanceof Folder !== true) {
		return new Folder(obj);
	}

	obj = normalize(obj);

	var self = this;
	var pointer = obj.pointer || new Pointer(obj);
	var pointers = undefined;

	Object.getOwnPropertyNames(pointer).forEach(function (prop) {
		Object.defineProperty(self, prop, Object.getOwnPropertyDescriptor(pointer, prop));
	});

	Object.defineProperties(self, {
		_type: {
			value: 'directory'
		},
		_pointers: {
			get: function () { return pointers; }
		},
		__add: {
			value: function(filePath, content, force, callback) {
				if (typeof force === 'function') {
					callback = force;
					force = false;
				}
				if (typeof content === 'function') {
					callback = content;
					force = false;
					content = false;
				}

				var fPath = path.join(self._path, filePath);

				if(typeof content === 'string') {
					File.__create(fPath, content, force, callback);
				} else {
					Folder.__create(fPath, force, callback);
				}
			}
		},
		__delete: {
			value: function (force, callback) {
				if (force instanceof Function) {
					callback = force;
					force = false;
				}

				pointer.__stopWatch();

				callback = callback || function (err) {
					if (err) {
						pointer.__emit('error', err);
					}
				};

				function end(err) {
					if (err) {
						callback(err);
						return;
					}
					callback(null, self.__remove());
				}

				var func = force ? rimraf : fs.rmdir;
				func(self._path, end);
			}
		},
		__list: {
			value: function(callback) {
				fs.readdir(self._path, function (err, _f) {
					if(err) {
						callback(err);
						return;
					}
					pointers = _f;
					callback(null, _f);
				});
			}
		}
	});
}

Object.defineProperty(Folder, '__create', {
	value: function(path, force, callback) {
		if(typeof force === 'function') {
			callback = force;
			force = false;
		}

		function end(err) {
			if(err) {
				callback(err);
				return;
			}
			var f = new Folder(path);
			callback(null, f);
		}

		if(force) {
			mkdirp(path, end);
		} else {
			fs.mkdir(path, end);
		}
	}
});

function normalize(obj) {
	if(typeof obj === 'string') {
		return {filePath: obj};
	}
	if(obj instanceof Pointer) {
		return {filePath: obj._path, pointer: obj, type: obj._type, stats: obj._stats};
	}
	if(obj.stats){
		obj.type = obj.stats.isDirectory() ? 'directory' : 'file';
	}
	return obj;
}

function create(obj) {
	switch (obj.type) {
		case 'directory':
			return new Folder(obj);
			break;
		case 'file':
			return new File(obj);
			break;
		default:
			return new Pointer(obj);
	}
}

module.exports.File = File;
module.exports.Folder = Folder;
module.exports.Pointer = Pointer;

module.exports.create = createObj;

function createObj(filePath, stats) {
	var obj = normalize(filePath);
	if(stats && typeof stats !== 'function' || !stats) {
		obj.stats = stats;
		obj = normalize(obj);
		return create(obj);
	}
	var callback = stats;
	fs.stat(obj.filePath, function(err, s) {
		if(err) {
			callback(err);
			return;
		}
		obj.stats = s;
		obj = normalize(obj);
		callback(null, create(obj));
	});

}