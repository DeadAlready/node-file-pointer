'use strict';

var fs = require('fs');
var File = require('./file');
var utils = require('./utils');
var Folder = require('./folder');
var Pointer = require('./pointer');

/**
 * Function for creating an object based on type and options
 * @param obj {Object} - description of the object to create
 * @returns {Pointer|File|Folder}
 */
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

/**
 * Function for creating an object
 * @param filePath {Object|String} - path to file or options object
 * @param stats {Object|Function} - FSStat object or callback function
 * @returns {Pointer|File|Folder|undefined}
 */
function createObj(filePath, stats) {

	if (filePath.constructor.name === 'File' || filePath.constructor.name === 'Folder') {
		return filePath;
	}

	var obj = utils.normalize(filePath);
	if(stats && typeof stats !== 'function' || !stats) {
		obj.stats = stats;
		obj = utils.normalize(obj);
		return create(obj);
	}
	var callback = stats;
	fs.stat(obj.filePath, function(err, s) {
		if(err) {
			callback(err);
			return;
		}
		obj.stats = s;
		obj = utils.normalize(obj);
		callback(null, create(obj));
	});

}

module.exports.File = File;
module.exports.Folder = Folder;
module.exports.Pointer = Pointer;

module.exports.create = createObj;