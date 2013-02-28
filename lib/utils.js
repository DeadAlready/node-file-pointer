'use strict';

var util = require('util');

Object.keys(util).forEach(function (key) {
	module.exports[key] = util[key];
});

/**
 * Function for creating a clone of an object
 *
 * @param obj {Object}  object to clone
 * @return {Object}
 */
function clone(obj) {
	if (typeof obj !== 'object') {
		return obj;
	}
	var ret;
	if (util.isArray(obj)) {
		ret = [];
		obj.forEach(function(val) {
			ret.push(clone(val));
		});
		return ret;
	}

	if (obj instanceof Buffer) {
		ret = new Buffer(obj.length);
		obj.copy(ret);
		return ret;
	}

	ret = {};
	Object.keys(obj).forEach(function (key) {
		ret[key] = clone(obj[key]);
	});
	return ret;
}

/**
 * Transfer properties from one object to the other
 *
 * @param {Object} a -> target object
 * @param {Object} b -> object to transfer from
 * @return {Object}
 */
function transfer(a, b) {
	for (var i in b) {
		a[i] = b[i];
	}
	return a;
}

module.exports.clone = clone;
module.exports.transfer = transfer;