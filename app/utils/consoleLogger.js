"use strict";

/**
 * Levels of logs.
 * @type {Array}
 */
var levels = ["debug", "log", "info", "warn", "error"];
var filters = [];

/**
 * Default level is warn.
 * @type {Number}
 */
var minLevel = 3;

/**
 * By default it is not enabled.
 * @type {Boolean}
 */
var enabled = false;

/**
 * Returns the numeric representation of a string level.
 * @param  {string} level String representation of the log level e.g. warn
 * @return {number} Numeric representation of the log level e.g. 3
 */
var levelIndex = function (level) {
	if (typeof Array.prototype.indexOf === 'function') {
		return levels.indexOf(level);
	} else {
		for (var i=0; i<levels.length; i++) {
			if (levels[i] === level) {
				return i;
			}
		}

		return -1;
	}
};

/**
 * Function which returns a corresponding wrapper around the native console object.
 *
 * If the console exists, it wraps around it. If it doesn't support calling as a wrapper, it calls directly by
 * stringifying the objects.
 *
 * If the corresponding function of console doesn't exist (e.g. console.debug in IE8), it automatically falls back to the widely
 * available console.log
 *
 * @return {function} function (level, args)
 */
var loggerFunction = (function () {
	if (typeof console !== 'undefined' && typeof console.log !== 'undefined') {
		return function (level, module, args) {
			if (enabled === true) {
				if (level >= minLevel) {
					if (filters.length === 0 || filters.indexOf(module) !== -1) {
						args.unshift(levels[level].toUpperCase());

						try {
							console[levels[level]].apply(console, args);
						} catch (e) {
							try {
								console.log.apply(console, args);
							} catch (e2) {
								for (var i = 0; i < args.length; i++) {
									args[i] = JSON.stringify(args[i]);
								}

								try {
									console[levels[level]](args.join(' '));
								} catch (exc) {
									console.log(args.join(' '));
								}
							}
						}
					}
				}
			}
		};
	} else {
		return function () {};
	}
}());

/**
 * logger.debug, logger function for the debug level.
 * @param  {any} args Any number of arguments of any type
 */
exports.debug = (function () {
	const level = levelIndex('debug');
	return function () {
		loggerFunction(level, arguments[0], Array.prototype.slice.apply(arguments));
	};
}());

/**
 * logger.log, logger function for the log level.
 * @param  {any} args Any number of arguments of any type
 */
exports.log = (function () {
	const level = levelIndex('log');
	return function () {
		loggerFunction(level, arguments[0], Array.prototype.slice.apply(arguments));
	};
}());

/**
 * logger.info, logger function for the info level.
 * @param  {any} args Any number of arguments of any type
 */
exports.info = (function () {
	const level = levelIndex('info');
	return function () {
		loggerFunction(level, arguments[0], Array.prototype.slice.apply(arguments));
	};
}());

/**
 * logger.warn, logger function for the warn level.
 * @param  {any} args Any number of arguments of any type
 */
exports.warn = (function () {
	const level = levelIndex('warn');
	return function () {
		loggerFunction(level, arguments[0], Array.prototype.slice.apply(arguments));
	};
}());

/**
 * logger.error, logger function for the error level.
 * @param  {any} args Any number of arguments of any type
 */
exports.error = (function () {
	const level = levelIndex('error');
	return function () {
		loggerFunction(level, arguments[0], Array.prototype.slice.apply(arguments));
	};
}());

/**
 * Enables the logging.
 * @return {undefined}
 */
exports.enable = function () {
	enabled = true;
};

/**
 * Disables the logging.
 * @return {undefined}
 */
exports.disable = function () {
	enabled = false;
};

/**
 * Sets the minimum level of log that is considered.
 * @param {number|string} level Either a numeric (0-4) or string (debug, log, info, warn, error) representation of the level.
 * @return {undefined}
 */
exports.setLevel = function (level) {
	if (typeof level === 'string') {
		if (isNaN(parseInt(level, 10))) {
			if (levelIndex(level) !== -1) {
				minLevel = levelIndex(level);
			} else {
				throw "Level not exists";
			}
		} else {
			if (level >= 0 && level <= levels.length-1) {
				minLevel = level;
			} else {
				throw "Level out of range.";
			}
		}
	} else if (typeof level === 'number') {
		if (level >= 0 && level <= levels.length-1) {
			minLevel = level;
		} else {
			throw "Level out of range.";
		}
	}
};

exports.addFilter = function (filterItem) {
	filters.push(filterItem);
};
