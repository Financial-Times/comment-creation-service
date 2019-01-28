"use strict";

const request = require('../utils/request_with_defaults.js');
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
				error: new Error('"articleId", "url" and "title" should be provided.'),
				safeMessage: true
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

		request.get(url, function (err, response) {
			endTimer(timer, 'getCollectionDetails', config.articleId);

			let body;
			if (response && response.body) {
				try {
					body = JSON.parse(response.body);
				} catch (e) {
					body = null;
				}
			} else {
				body = null;
			}

			if (err || !response || response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('suds.getCollectionDetails error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			resolve(body);
		});
	});

	return promise;
};

exports.getAuth = function (sessionId) {
	const promise = new Promise((resolve, reject) => {
		if (!sessionId) {
			reject({
				statusCode: 400,
				error: new Error('"sessionId" should be provided.'),
				safeMessage: true
			});
			return;
		}

		let timer = new Timer();

		const url = `${env.suds.api.getAuth}?sessionId=${sessionId}`

		request.get({
			url,
			headers:{
				'X-Api-Key': process.env.SUDS_API_KEY
			}
		}, function (err, response) {
			endTimer(timer, 'getAuth');

			let body;
			if (response && response.body) {
				try {
					body = JSON.parse(response.body);
				} catch (e) {
					body = null;
				}
			} else {
				body = null;
			}

			if (err || !response || response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('suds.getAuth error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			resolve(body);
		});
	});

	return promise;
};

exports.getSiteId = function (articleId) {
	const promise = new Promise((resolve, reject) => {
		if (!articleId) {
			reject({
				statusCode: 400,
				error: new Error('"articleId" should be provided.'),
				safeMessage: true
			});
			return;
		}

		const url = `${env.suds.api.getSiteId}?articleId=${encodeURIComponent(articleId)}`;

		let timer = new Timer();

		request.get({
			url,
			headers: {
				'X-Api-Key': process.env.SUDS_API_KEY
			}
		}, function (err, response) {
			endTimer(timer, 'getSiteId');

			let body;
			if (response && response.body) {
				try {
					body = JSON.parse(response.body);
				} catch (e) {
					body = null;
				}
			} else {
				body = null;
			}

			if (err || !response || response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('suds.getSiteId error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			resolve(body);
		});
	});

	return promise;
};
