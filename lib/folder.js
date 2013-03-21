'use strict';

var fs = require('fs');
var path = require('path');
var utils = require('./utils');
var Pointer = require('./pointer');
var File = require('./file');


function Folder(obj) {
	if (!(this instanceof Folder)) {
		return new Folder(obj);
	}

	obj = utils.normalize(obj);

	var self = this;
	var pointer = obj.pointer || new Pointer(obj);
	var pointers = undefined;

    // Copy properties from pointer
    Object.getOwnPropertyNames(pointer).forEach(function (prop) {
        var desc = Object.getOwnPropertyDescriptor(pointer, prop);
        if (prop.charAt(1) === '_') {
            desc.value = function (arg1, arg2) {
                pointer[prop](arg1, arg2);
            }
        }
        Object.defineProperty(self, prop, desc);
    });

	Object.defineProperties(self, {
		// Overwrite type to directory
		_type: {
			value: 'directory'
		},
		// List subfiles
		_pointers: {
			get: function () { return pointers; }
		},
		// Function for adding a file or folder under this objects path
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

				function end(err, res) {
					if (err) {
						callback(err);
						return;
					}
					self[res._path] = res;
					callback(null, res);
				}

				var opts = {
					filePath: path.join(self._path, filePath),
					parent: self
				};

				if(typeof content === 'string') {
					File.__create(opts, content, force, callback);
				} else {
					Folder.__create(opts, force, callback);
				}
			}
		},
		// Function for deleting this folder
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
		// Function for listing results from fs.readdir
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
		},
		// Remove a child pointer
		__removeChild: {
			value: function (opts) {
				if (typeof opts === 'string' && self[opts]) {
					self[opts]._parent = undefined;
					delete self[opts];
				} else {
					Object.keys(self).forEach(function (key) {
						if (self[key] === opts) {
							self[key]._parent = undefined;
							delete self[key];
						}
					});
				}
			}
		}
	});
}

// Define function for creating a folder in the file system
Object.defineProperty(Folder, '__create', {
	value: function(filePath, force, callback) {
		if(typeof force === 'function') {
			callback = force;
			force = false;
		}

		var opts = utils.normalize(filePath);

		function end(err) {
			if(err) {
				callback(err);
				return;
			}
			var f = new Folder(opts);
			callback(null, f);
		}

		if(force) {
			mkdirp(opts.filePath, end);
		} else {
			fs.mkdir(opts.filePath, end);
		}
	}
});

module.exports = Folder;