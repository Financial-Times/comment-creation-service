"use strict";

const urlParser = require('url');
const queryStringParser = require('querystring');

module.exports = function (config) {
	config = config || {};

	const history = {};

	this.getParamsForId = function (id) {
		return history[id];
	};

	this.mock = {
		get: function (url, params, callback) {
			if (typeof params === 'function' && !callback) {
				callback = params;
				params = null;
			}


			// matchmaking
			let type;
			let match;

			if (config.env.suds.api.getCollectionDetails) {
				let matchSudsCollectionDetails = url.match(new RegExp(config.env.suds.api.getCollectionDetails.replace('?', '\\?') + '(.*)'));
				if (matchSudsCollectionDetails && matchSudsCollectionDetails.length) {
					type = 'sudsCollectionDetails';
					match = matchSudsCollectionDetails;
				}
			}

			if (config.env.suds.api.getAuth) {
				let matchSudsGetAuth = url.match(new RegExp(config.env.suds.api.getAuth.replace('?', '\\?') + '(.*)'));
				if (matchSudsGetAuth && matchSudsGetAuth.length) {
					type = 'sudsGetAuth';
					match = matchSudsGetAuth;
				}
			}


			if (match && match.length) {
				switch (type) {
					case 'sudsCollectionDetails':
						const parsedUrl = urlParser.parse(url);
						const parsedQueryString = queryStringParser.parse(parsedUrl.query);

						if (parsedQueryString.articleId && parsedQueryString.articleId.indexOf('down') !== -1) {
							callback(new Error("Service down."));
							return;
						}

						if (!config.sudsCollectionDetailsArticle[parsedQueryString.articleId]) {
							callback(null, {
								statusCode: 404
							});
							return;
						}

						history[parsedQueryString.articleId] = parsedQueryString;

						callback(null, {
							statusCode: 200,
							body: config.sudsCollectionDetailsArticle[parsedQueryString.articleId]
						});

						break;

					case 'sudsGetAuth':
						break;

					default:
						throw "Not supported";
				}
			} else {
				throw "Not supported";
			}
		},
		post: function (url, params, callback) {

		},
		'@global': config.global === true ? true : false
	};
};
