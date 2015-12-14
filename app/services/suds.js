"use strict";

const needle = require('needle');
const consoleLogger = require('../utils/consoleLogger');
const env = require('../../env');
const Timer = require('../utils/Timer');

const endTimer = function (timer, serviceName, id) {
	let elapsedTime = timer.getElapsedTime();
	if (elapsedTime > 5000) {
		consoleLogger.warn(id ? id : '', 'suds.'+ serviceName +': service high response time', elapsedTime + 'ms');
	} else {
		consoleLogger.info(id ? id : '', 'suds.'+ serviceName +': service response time', elapsedTime + 'ms');
	}
};


exports.getCollectionDetails = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || !config.articleId || !config.title || !config.url) {
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

		if (config.sessionId) {
			url += '&sessionId=' + encodeURIComponent(config.sessionId);
		}

		if (config.tags) {
			url += '&tags=' + encodeURIComponent(config.tags);
		}

		if (config.streamType) {
			url += '&stream_type=' + encodeURIComponent(config.streamType);
		}


		let timer = new Timer();

		needle.get(url, function (err, response) {
			endTimer(timer, 'getCollectionDetails', config.articleId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				if (err) {
					consoleLogger.warn('suds.getAuth error', err);
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

		let timer = new Timer();

		needle.get(env.suds.api.getAuth + '?sessionId=' + sessionId, function (err, response) {
			endTimer(timer, 'getAuth');

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				if (err) {
					consoleLogger.warn('suds.getAuth error', err);
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
