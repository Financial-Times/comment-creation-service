"use strict";

const request = require('../utils/request_with_defaults.js');
const env = require('../../env');
const consoleLogger = require('../utils/consoleLogger');
const Timer = require('../utils/Timer');
const _ = require('lodash');
const livefyreLib = require('livefyre');



var network = livefyreLib.getNetwork(env.livefyre.network.name + '.fyre.co', env.livefyre.network.key);

var systemTokenCache = {
	token: null,
	expiresAt: null
};
var getSystemToken = function () {
	if (systemTokenCache.token && systemTokenCache.expiresAt < new Date()) {
		return systemTokenCache.token;
	}

	systemTokenCache.token = network.buildLivefyreToken();
	systemTokenCache.expiresAt = new Date(new Date().getTime() + 1000 * 60 * 60 * 23.5);

	return systemTokenCache.token;
};



const endTimer = function (timer, serviceName, url) {
	let elapsedTime = timer.getElapsedTime();
	if (elapsedTime > 5000) {
		consoleLogger.warn('livefyre.'+ serviceName +': service high response time', elapsedTime + 'ms', url);
	} else {
		consoleLogger.info('livefyre.'+ serviceName +': service response time', elapsedTime + 'ms', url);
	}
};

exports.createCollection = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || !config.collectionMeta || !config.siteId) {
			reject({
				statusCode: 400,
				error: new Error("'collectionMeta' and 'siteId' should be provided."),
				safeMessage: true
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


		request.post(url, {
			json: postData
		}, (err, response) => {
			endTimer(timer, 'createCollection', url);

			if (err || !response || response.statusCode < 200 || response.statusCode >= 400) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('livefyre.createCollection error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: null,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
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
				error: new Error("'articleId' and 'siteId' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.collectionInfoPlusUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{siteId\}/g, config.siteId);
		url = url.replace(/\{articleIdBase64\}/g, new Buffer(config.articleId).toString('base64'));

		let timer = new Timer();

		request.get(url, (err, response) => {
			endTimer(timer, 'getCollectionInfoPlus', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('livefyre.getCollectionInfoPlus error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			if (body && body.collectionSettings && body.headDocument) {
				resolve(body);
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
				error: new Error("'articleId', 'siteId', and 'pageNumber' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.commentsByPageUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{siteId\}/g, config.siteId);
		url = url.replace(/\{articleIdBase64\}/g, new Buffer(config.articleId).toString('base64'));
		url = url.replace(/\{pageNumber\}/g, config.pageNumber);

		let timer = new Timer();

		request.get(url, (err, response) => {
			endTimer(timer, 'getCommentsByPage', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('livefyre.getCommentsByPage error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			if (body && body.content && body.authors) {
				resolve(body);
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
				error: new Error("'collectionId' and 'token' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.unfollowCollectionUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{collectionId\}/g, config.collectionId);

		let timer = new Timer();

		request.post(url, {
			form: {
				lftoken: config.token
			}
		}, (err, response) => {
			endTimer(timer, 'unfollowCollection', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('livefyre.unfollowCollection error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			if (body && body.status === "ok") {
				resolve(body);
			} else {
				reject({
					statusCode: response && response.statusCode ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: body
				});
			}
		});
	});

	return promise;
};

exports.postComment = function (config) {
	const promise = new Promise((resolve, reject) => {
		if (!config || typeof config !== 'object' || typeof config.collectionId !== 'number' || !config.token || !config.commentBody) {
			if (config && !config.token) {
				reject({
					statusCode: 401,
					invalidSession: true
				});
				return;
			}

			reject({
				statusCode: 400,
				error: new Error("'collectionId' and 'commentBody' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.postCommentUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{collectionId\}/g, config.collectionId);

		let timer = new Timer();

		request.post(url, {
			form: {
				lftoken: config.token,
				body: config.commentBody
			}
		}, (err, response) => {
			endTimer(timer, 'postComment', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (response && response.statusCode === 403 && body && body.msg === 'Wrong domain') {
					reject({
						error: err,
						responseBody: body ? _.extend(body, {
							code: 404,
							msg: 'Collection not found'
						}) : null,
						statusCode: 404
					});
					return;
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});

				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('livefyre.postComment error', err || new Error(response ? response.statusCode : 'No response'));
				}
				return;
			}

			if (body && body.status === "ok" && body.data && body.data.messages && body.data.messages.length) {
				resolve(body);
			} else {
				reject({
					statusCode: response && response.statusCode ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: body
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
				error: new Error("'collectionId', 'commentId' and 'token' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.deleteCommentUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{commentId\}/g, config.commentId);

		let timer = new Timer();

		request.post(url, {
			form: {
				lftoken: config.token,
				collection_id: config.collectionId
			}
		}, (err, response) => {
			endTimer(timer, 'deleteComment', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				if (response && response.statusCode === 403 && body && body.msg === 'Wrong domain') {
					reject({
						error: err,
						responseBody: body ? _.extend(body, {
							code: 404,
							msg: 'Collection not found'
						}) : null,
						statusCode: 404
					});
					return;
				}

				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.deleteComment error', err);
				}
				return;
			}

			if (body && body.status === "ok") {
				resolve(body);
			} else {
				reject({
					statusCode: response && response.statusCode ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: body
				});
			}
		});
	});

	return promise;
};


exports.closeCollection = function (collectionId) {
	const setting = 'commenting_enabled';

	return new Promise((resolve, reject) => {
		if (!collectionId) {
			reject({
				statusCode: 400,
				error: new Error("'collectionId' should be provided."),
				safeMessage: true
			});
			return;
		}

		let url = env.livefyre.api.changeCollectionUrl;
		url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
		url = url.replace(/\{collectionId\}/g, collectionId);
		url = url.replace(/\{setting\}/g, setting);


		let timer = new Timer();
		request.post(url + '?lftoken=' + getSystemToken(), {
			body: 'false'
		}, function (err, response) {
			endTimer(timer, 'closeCollection', url);

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

			if (err || !response|| response.statusCode < 200 || response.statusCode >= 400 || !body) {
				reject({
					error: err,
					responseBody: body,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});

				if (err) {
					consoleLogger.warn('livefyre.closeCollection error', err);
				}
				return;
			}

			if (body && body.status === "ok") {
				resolve(body);
			} else {
				reject({
					statusCode: response && response.statusCode ? response.statusCode : 503,
					error: new Error("Invalid response received from Livefyre."),
					responseBody: body
				});
			}
		});
	});
};
