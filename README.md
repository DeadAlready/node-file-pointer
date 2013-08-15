[file-pointer](https://github.com/DeadAlready/node-file-pointer) is a object wrapper to handle files.

# Installation

    $ npm install file-pointer

# Essence

[file-pointer](https://github.com/DeadAlready/node-file-pointer) is meant to provide an object wrapper
around files and folders for easier manipulation and handling. It does this by creating a number of non-enumberable
properties that provide easy access to various manipulations with the underlying file.

# Usage

These are various examples of using the file-pointer library

		var fp = require('file-pointer');

		// Basic
		var obj = fp.define('./node_modules'); // returns Pointer

		fp.define('./node_modules', function (err, obj) {
			// Obj is a Folder, since the stats were mapped and it was determined to be one
		});

		// Direct calls

		var file = new fp.File('./index.js');
		var folder = new fp.Folder('./node_modules');
		var pointer = new fp.Pointer('./test');

		// use the previously created pointer to create a File
		var testFile = new fp.File({pointer: pointer});

		// Create a Folder by defining opts.type
		var syncFolder = fp.define({filePath: './node_modules, type:'directory'});

# Added properties

The main objective of file-pointer is to add convenience methods to the objects for easy usage.
These are either values or functions. All values are preceeded by a single underscore and all functions with two underscores.

## Pointer

The following properties are added to Pointer object and since File and Folder inherit from Pointer then
they are accessible on all types.

* _parent - placeholder for possible parent folder
* _path - full path to file
* _name - filename
* _base - file name without extension
* _type - 'file','directory' or undefined
* _ext - file extension
* _stats - cached FSStat object or undefined

* __remove() - if parent is defined Folder, remove pointer from it
* __delete(callback) - delete file from system
* __stats([force], [callback]) - return _stats or ask for fs.stat
* __listen(name, fn) - add an event listener
* __removeListener(name, fn) - removes previously set listener
* __deconstruct() - stops watching, removes from parent and all listeners
* __emit(event, [arg1], [arg2], [...]) - emit an event with arguments
* __startWatch() - open fs.watch and emit "change", "error" and "missing" events
* __stopWatch() - close fs.watch

None of these properties are enumerable and only _type is configurable.
This means that:

		var fp = require('file-pointer');

		var p = new fp.Pointer('./node_modules');

		console.log(p); // Will log an apparently empty object {}
		console.log(p._name); // node_modules
		p._name = 'test';
		console.log(p._name); // node_modules

## File

These properties are added to the Pointer object properties.

* _type = 'file' // No longer configurable

* __read([callback]) - if a callback is provided utf8 content is returned, otherwise a readable stream
* __write([content], [callback]) - if no arguments a writeable stream is returned,
otherwise contents will be written to file and callback executed on completion
* __delete([force],[callback]) - will delete the file from file system, force will determine if rimraf is used instead of fs.unlink


## Folder

These properties are added to the Pointer object properties.

* _type = 'directory' // No longer configurable
* _pointers - cached list of fs.readdir results or undefined

* __add(filePath, [content], [force], [callback]) - add a file or directory to the filesystem under current Folder,
will use File._\_create or Folder._\_create depending on existence of content
* __delete([force],[callback]) - delete folder from system, force will decide if rimraf or fs.rmdir is used
* __list(callback) - use fs.readdir and return results
* __watchList([persistent], callback) - watch the folder changes and run __list on changes to the folder
* __removeChild(opts) - remove a child object either by property name or object


## Public API

The file-pointer will expose the following methods of interest.

### define(opts, [callback])

Function for creating a file-pointer object

__opts__ - can be either string or object with the following properties
* - filePath: required
* - type: 'file' or 'directory'
* - stats: FSStat object
* - parent: parent object
* - watch: 'persistent' or boolean - wheter to start watching the underlying file

__callback__ - if defined then fs.stat function is used to determine the type of the object

## License

The MIT License (MIT)
Copyright (c) 2012 Karl Düüna

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.