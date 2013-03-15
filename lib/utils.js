'use strict';

function normalize(obj) {
	if(typeof obj === 'string') {
		return {filePath: obj};
	}
	if(obj.constructor.name === 'Pointer') {
		return {
			filePath: obj._path,
			pointer: obj,
			type: obj._type,
			stats: obj._stats
		};
	}
	if(obj.stats){
		obj.type = obj.stats.isDirectory() ? 'directory' : 'file';
	}
	return obj;
}

module.exports.normalize = normalize;