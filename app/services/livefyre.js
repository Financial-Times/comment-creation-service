"use strict";

const needle = require('needle');
const env = require('../../env');
const consoleLogger = require('../utils/consoleLogger');
const Timer = require('../utils/Timer');

const endTimer = function (timer, serviceName, id) {
	let elapsedTime = timer.getElapsedTime();
	if (elapsedTime > 5000) {
		consoleLogger.warn(id ? id : '', 'livefyre.'+ serviceName +': high response time', elapsedTime + 'ms');
	} else {
		consoleLogger.info(id ? id : '', 'livefyre.'+ serviceName +': response time', elapsedTime + 'ms');
	}
};

exports.createCollection = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.collectionMeta || !config.siteId) {
			reject({
				statusCode: 400,
				error: new Error("'collectionMeta' and 'siteId' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.createCollectionUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{siteId\}/g, config.siteId);

		const postData = {
			collectionMeta: config.collectionMeta
		};
		if (config.checksum) {
			postData.checksum = config.checksum;
		}

		let timer = new Timer();

		needle.post(url, postData, {json: true}, (err, response) => {
			endTimer(timer, 'createCollection');

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.createCollection error', err);
				}
				return;
			}

			resolve();
		});
	});

	return promise;
};



exports.getCollectionInfoPlus = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.articleId || !config.siteId) {
			reject({
				statusCode: 400,
				error: new Error("'articleId' and 'siteId' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.collectionInfoPlusUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{siteId\}/g, config.siteId);
		url = url.replace(/\{articleIdBase64\}/g, new Buffer(config.articleId).toString('base64'));

		let timer = new Timer();

		needle.get(url, (err, response) => {
			endTimer(timer, 'getCollectionInfoPlus', config.articleId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300) || !response.body) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.getCollectionInfoPlus error', err);
				}
				return;
			}

			if (response.body && response.body.collectionSettings && response.body.headDocument) {
				resolve(response.body);
			} else {
				reject({
					statusCode: 503,
					error: new Error("Invalid response received from Livefyre.")
				});
			}
		});
	});

	return promise;
};

exports.getCommentsByPage = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.articleId || !config.siteId || !config.hasOwnProperty('pageNumber')) {
			reject({
				statusCode: 400,
				error: new Error("'articleId', 'siteId', and 'pageNumber' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.commentsByPageUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{siteId\}/g, config.siteId);
		url = url.replace(/\{articleIdBase64\}/g, new Buffer(config.articleId).toString('base64'));
		url = url.replace(/\{pageNumber\}/g, config.pageNumber);

		let timer = new Timer();

		needle.get(url, (err, response) => {
			endTimer(timer, 'getCommentsByPage', config.articleId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300)) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.getCommentsByPage error', err);
				}
				return;
			}

			if (response.body && response.body.content && response.body.authors) {
				resolve(response.body);
			} else {
				reject({
					statusCode: 503,
					error: new Error("Invalid response received from Livefyre.")
				});
			}
		});
	});

	return promise;
};

exports.unfollowCollection = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.collectionId || !config.token) {
			reject({
				statusCode: 400,
				error: new Error("'collectionId' and 'token' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.unfollowCollectionUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{collectionId\}/g, config.collectionId);

		let timer = new Timer();

		needle.post(url, {
			lftoken: config.token
		}, (err, response) => {
			endTimer(timer, 'unfollowCollection', config.collectionId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300)) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.unfollowCollection error', err);
				}
				return;
			}

			if (response.body && response.body.status === "ok") {
				resolve(response.body);
			} else {
				reject({
					statusCode: response && response.body ? response.body.code || 503 : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: response ? response.body : null
				});
			}
		});
	});

	return promise;
};

exports.postComment = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.collectionId || !config.token || !config.commentBody) {
			reject({
				statusCode: 400,
				error: new Error("'collectionId', 'commentBody' and 'token' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.postCommentUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{collectionId\}/g, config.collectionId);

		let timer = new Timer();

		needle.post(url, {
			lftoken: config.token,
			body: config.commentBody
		}, (err, response) => {
			endTimer(timer, 'postComment', config.collectionId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300)) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.postComment error', err);
				}
				return;
			}

			if (response.body && response.body.status === "ok" && response.body.data && response.body.data.messages && response.body.data.messages.length) {
				resolve(response.body);
			} else {
				reject({
					statusCode: response ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: response ? response.body : null
				});
			}
		});
	});

	return promise;
};

exports.deleteComment = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.collectionId || !config.token || !config.commentId) {
			reject({
				statusCode: 400,
				error: new Error("'collectionId', 'commentId' and 'token' should be provided.")
			});
			return;
		}

		let url = env.livefyre.api.deleteCommentUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{commentId\}/g, config.commentId);

		let timer = new Timer();

		needle.post(url, {
			lftoken: config.token,
			collection_id: config.collectionId
		}, (err, response) => {
			endTimer(timer, 'deleteComment', config.commentId);

			if (err || !response || (response.statusCode < 200 || response.statusCode >= 300)) {
				reject({
					error: err,
					responseBody: response ? response.body : null,
					statusCode: response ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.deleteComment error', err);
				}
				return;
			}

			if (response.body && response.body.status === "ok") {
				resolve(response.body);
			} else {
				reject({
					statusCode: response ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: response ? response.body : null
				});
			}
		});
	});

	return promise;
};
