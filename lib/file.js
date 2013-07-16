'use strict';

var fs = require('fs');
var utils = require('./utils');
var Pointer = require('./pointer');

function File(obj) {
	if (!(this instanceof File)) {
		return new File(obj);
	}

	obj = utils.normalize(obj);

	var self = this;
	var pointer = obj.pointer || new Pointer(obj);

	// Copy properties from pointer
	Object.getOwnPropertyNames(pointer).forEach(function (prop) {
        var desc = Object.getOwnPropertyDescriptor(pointer, prop);
        if (prop.charAt(1) === '_') {
            desc.value = function (arg1, arg2) {
                return pointer[prop](arg1, arg2);
            }
        }
        Object.defineProperty(self, prop, desc);
	});

	Object.defineProperties(self, {
		// Overwrite type to file
		_type: {
			value: 'file'
		},
		// Function for reading file or creating readStream
		__read: {
			value: function (callback) {
				if (callback) {
					fs.readFile(self._path, 'utf8', callback);
					return;
				}
				return fs.createReadStream(self._path);
			}
		},
		// Function for writing to file or creating writeStream
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
		// Function for deleting a file
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

// Define a method for creating a file in the filesystem
Object.defineProperty(File, '__create', {
	value: function(filePath, content, force, callback) {
		if(typeof force === 'function') {
			callback = force;
			force = false;
		}

		var opts = utils.normalize(filePath);

		function createFile(again) {
			fs.writeFile(opts.filePath, content, 'utf8', function(err){
				if(err) {
					if(!again) {
						callback(err);
						return;
					}
					Folder.__create(path.dirname(opts.filePath), true, function (err) {
						if(err) {
							callback(err);
							return;
						}
						createFile(false);
					});
					return;
				}
				var f = new File(opts);
				callback(null, f);
			});
		}

		createFile(force);
	}
});

module.exports = File;