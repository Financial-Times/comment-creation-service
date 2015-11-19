"use strict";

const _ = require('lodash');
const needle = require('needle');

const env = require('../../env');


exports.getCollectionDetails = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config.articleId || !config.title || !config.url) {
			reject({
				statusCode: 400,
				error: new Error('"articleId", "url" and "title" should be provided.')
			});
			return;
		}

		let url = env.suds.api.getCollectionDetails;
		url += '?articleId=' + encodeURIComponent(config.articleId);
		url += '&title=' + encodeURIComponent(config.title);
		url += '&url=' + encodeURIComponent(config.url);
		url += '&sessionId=' + encodeURIComponent(config.sessionId);
		if (config.tags) {
			url += '&tags=' + encodeURIComponent(config.tags);
		}
		if (config.streamType) {
			url += '&stream_type=' + encodeURIComponent(config.streamType);
		}

		needle.get(url, function (err, response) {
			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				if (err) {
					//log
				}

				reject({
					error: err || new Error("StatusCode: " + response.statusCode),
					statusCode: response ? response.statusCode : 503,
					responseBody: response ? response.body : null
				});
			} else {
				resolve(response.body);
			}
		});
	});

	return promise;
};

exports.getAuth = function (sessionId) {
	const promise = new Promise((resolve, reject) => {
		if (!sessionId) {
			reject({
				statusCode: 400,
				error: new Error('"sessionId" should be provided.')
			});
			return;
		}

		needle.get(env.suds.api.getAuth + '?sessionId=' + sessionId, function (err, response) {
			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				if (err) {
					//log
				}

				reject({
					error: err || new Error("StatusCode: " + response.statusCode),
					statusCode: response ? response.statusCode : 503,
					responseBody: response ? response.body : null
				});
			} else {
				resolve(response.body);
			}
		});
	});

	return promise;
};
