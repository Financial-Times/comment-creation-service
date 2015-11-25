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

	this.mock = {
		get: function (url, params, callback) {
			if (typeof params === 'function' && !callback) {
				callback = params;
				params = null;
			}


			let resultOfMatch = matchUrl(url);

			if (resultOfMatch) {
				resultOfMatch.configItem.handler({
					url: url,
					params: params,
					callback: callback,
					configItem: resultOfMatch.configItem,
					matches: resultOfMatch.matches,
					history: history
				});
			} else {
				throw new Error("URL not covered");
			}
		},
		post: function (url, postData, params, callback) {
			if (typeof params === 'function' && !callback) {
				callback = params;
				params = null;
			}

			if (typeof postData === 'function' && !params && !callback) {
				callback = postData;
				postData = null;
			}


			let resultOfMatch = matchUrl(url);

			if (resultOfMatch) {
				resultOfMatch.configItem.handler({
					url: url,
					params: params,
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
