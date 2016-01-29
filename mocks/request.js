"use strict";

const urlParser = require('url');
const queryStringParser = require('querystring');

module.exports = function (config) {
	config = config || {
		items: []
	};

	const history = {};

	this.getParamsHistoryForId = function (id) {
		return history[id];
	};

	config.items.forEach((configItem) => {
		if (configItem && configItem.url) {
			let matches = configItem.url.match(new RegExp(/\{[^\}]+\}/g));
			configItem.urlParams = [];

			if (matches && matches.length) {
				matches.forEach((param) => {
					param = param.replace('{', '').replace('}', '');

					configItem.urlParams.push(param);
				});
			}
		}
	});


	function matchUrl (url) {
		let matches = {
			urlParams: {},
			queryParams: {},
			urlParsed: {}
		};

		try {
			for (let i = 0; i < config.items.length; i++) {
				let configItem = config.items[i];

				let urlMatched = url.match(new RegExp(configItem.url.replace(/\{[^\}]+\}/g, '([^\.\/]+)').replace('?', '\\?' + '(.*)')));
				if (urlMatched && urlMatched.length) {
					configItem.urlParams.forEach((urlParamName, index) => {
						matches.urlParams[urlParamName] = urlMatched[index + 1];
					});

					const parsedUrl = urlParser.parse(url);
					const parsedQueryString = queryStringParser.parse(parsedUrl.query);

					matches.queryParams = parsedQueryString;
					matches.urlParsed = parsedUrl;

					return {
						configItem: configItem,
						matches: matches
					};
				}
			}
		} catch (e) {
			console.error(e, e.stack);
			throw e;
		}
	}

	var self = this;
	this.mock = {
		defaults: function () {
			return self.mock;
		},
		get: function (urlOrOptions, options, callback) {
			if (typeof options === 'function' && !callback) {
				callback = options;
				options = null;
			}

			let url;
			if (typeof urlOrOptions === 'object') {
				url = urlOrOptions.url;
			} else {
				url = urlOrOptions;
			}


			let resultOfMatch = matchUrl(url);

			if (resultOfMatch) {
				resultOfMatch.configItem.handler({
					url: url,
					options: options,
					callback: callback,
					configItem: resultOfMatch.configItem,
					matches: resultOfMatch.matches,
					history: history
				});
			} else {
				throw new Error("URL not covered");
			}
		},
		post: function (urlOrOptions, options, callback) {
			if (typeof options === 'function' && !callback) {
				callback = options;
				options = null;
			}

			let postData;
			let url;
			if (typeof urlOrOptions === 'object') {
				url = urlOrOptions.url;
				postData = urlOrOptions.form || urlOrOptions.json;
			} else {
				url = urlOrOptions;
				postData = options ? options.form || options.json : null;
			}


			let resultOfMatch = matchUrl(url);

			if (resultOfMatch) {
				resultOfMatch.configItem.handler({
					url: url,
					options: options,
					postData: postData,
					callback: callback,
					configItem: resultOfMatch.configItem,
					matches: resultOfMatch.matches,
					history: history
				});
			} else {
				throw new Error("URL not covered");
			}
		},
		'@global': config.global === true ? true : false
	};
};
