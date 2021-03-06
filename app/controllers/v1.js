"use strict";

const sudsService = require('../services/suds');
const livefyreService = require('../services/livefyre');
const CollectionDataStore = require('../storage/CollectionDataStore');
const CommentsCache = require('../storage/CommentsCache');
const apiKeys = require('../storage/apiKeys');
const env = require('../../env');
const async = require('async');
const _ = require('lodash');
const consoleLogger = require('../utils/consoleLogger');
const urlParser = require('url');


exports.getComments = function (req, res) {
	const promise = new Promise((resolve, reject) => {
		if (!req.query.articleId || !req.query.url || !req.query.title) {
			reject({
				statusCode: 400,
				error: new Error('"articleId", "title" and "url" should be provided.')
			});
			return;
		}

		var parsedUrl = urlParser.parse(req.query.url);
		if (!parsedUrl || !parsedUrl.host || parsedUrl.host.indexOf('.') === -1) {
			reject({
				statusCode: 400,
				error: new Error('"url" is not a valid URL.')
			});
			return;
		}

		let sessionId;
		if (req.cookies && req.cookies['FTSession']) {
			sessionId = req.cookies['FTSession'];
		}
		if (req.query.sessionId) {
			sessionId = req.query.sessionId;
		}

		const pageNumber = req.query.pageNumber && typeof parseInt(req.query.pageNumber, 10) === 'number' ? parseInt(req.query.pageNumber) : null;

		async.parallel({
			collection: (callback) => {
				let collectionDataStore = new CollectionDataStore(req.query.articleId);

				collectionDataStore.getCollectionDetails(_.extend({}, _.pick(req.query, ['articleId', 'title', 'url', 'sessionId', 'tags']), {sessionId: sessionId})).then((collectionDetails) => {
					if (collectionDetails.collectionId && collectionDetails.siteId) {
						let commentsCache = new CommentsCache(req.query.articleId, collectionDetails.siteId);

						commentsCache.getCommentsByPage(pageNumber).then((commentsData) => {
							callback(null, {
								collectionId: collectionDetails.collectionId,
								siteId: collectionDetails.siteId,
								comments: commentsData.comments || [],
								lastEvent: commentsData.lastEvent || 0,
								totalPages: commentsData.totalPages,
								nextPage: commentsData.nextPage
							});
						}).catch((err) => {
							callback(err);
						});
					} else {
						callback(null, collectionDetails);
					}
				}).catch((err) => {
					callback(err);
				});
			},
			auth: (callback) => {
				if (sessionId) {
					sudsService.getAuth(sessionId).then((auth) => {
						callback(null, auth);
					}).catch((err) => {
						if (err.statusCode === 401) {
							callback(null, null);
						} else {
							callback({
								serviceUp: false
							});
						}
					});
				} else {
					callback(null, null);
				}
			}
		}, (err, results) => {
			if (err) {
				reject(err);
				return;
			}

			let moderator = false;
			if (results.auth && results.auth.moderationRights && results.collection) {
				results.auth.moderationRights.collections.forEach((collectionId) => {
					if (String(collectionId) === String(results.collection.collectionId)) {
						moderator = true;
					}
				});

				if (!moderator) {
					results.auth.moderationRights.networks.forEach((network) => {
						if (network === env.livefyre.network.name + '.fyre.co') {
							moderator = true;
						}
					});
				}

				if (!moderator) {
					results.auth.moderationRights.sites.forEach((siteId) => {
						if (String(siteId) === String(results.collection.siteId)) {
							moderator = true;
						}
					});
				}
			}

			if (results.auth && !results.auth.hasOwnProperty('serviceUp')) {
				results.auth.moderator = moderator;
			}

			resolve({
				collection: _.omit(results.collection, ['siteId']),
				userDetails: results.auth
			});
		});
	});


	promise.then((data) => {
		res.jsonp(data);
	}).catch((err) => {
		if (err.stack) {
			// probably exception
			consoleLogger.error(err, err.stack);
		}

		let statusCode;
		if (err.statusCode) {
			statusCode = err.statusCode;
		} else {
			statusCode = 503;
		}

		res.sendStatus(statusCode);
	});
};




const postComment = function (config) {
	return livefyreService.postComment({
		collectionId: config.collectionId,
		commentBody: config.commentBody,
		token: config.token
	}).then((commentData) => {
		return {
			bodyHtml: commentData.data.messages[0].content.bodyHtml,
			commentId: commentData.data.messages[0].content.id,
			createdAt: commentData.data.messages[0].content.createdAt,
			status: commentData.status,
			code: commentData.code
		};
	});
};




function sendActionSuccessResponse (req, res, data) {
	res.jsonp(_.extend(data, {
		success: true,
		invalidSession: false,
		status: "ok"
	}));
}

function sendActionFailResponse(req, res, err) {
	var isJsonP = req.query.callback ? true : false;

	if (err.stack) {
		// probably exception
		consoleLogger.error(err, err.stack);
	}

	var response = {
		success: false,
		status: "error"
	};

	let statusCode;
	if (err.statusCode) {
		statusCode = err.statusCode;
	} else {
		statusCode = 503;
	}

	if (err.responseBody && err.responseBody.code) {
		response.code = err.responseBody.code;
	} else {
		response.code = statusCode;
	}

	if (err.responseBody && err.responseBody.msg) {
		response.errorMessage = err.responseBody.msg;
	} else if (err.error && err.error.message && err.safeMessage) {
		response.errorMessage = err.error.message;
	} else if (statusCode === 401) {
		response.errorMessage = "User session is not valid.";
	} else if (statusCode === 400) {
		response.errorMessage = "Parameters missing or invalid.";
	} else if (statusCode === 503) {
		response.errorMessage = 'System is temporarily unavailable, please try again later.';
	}

	if (err.invalidSession === true) {
		response.invalidSession = true;
	} else {
		response.invalidSession = false;
	}

	res.status(isJsonP ? 200 : statusCode).jsonp(response);
}


exports.postComment = function (req, res) {
	const promise = new Promise((resolve, reject) => {
		let collectionId = parseInt(req.query.collectionId, 10);
		if (typeof collectionId !== 'number' || isNaN(collectionId)) {
			reject({
				statusCode: 400,
				error: new Error('"collectionId" should be a valid number.'),
				safeMessage: true
			});
			return;
		}

		if (!req.query.commentBody) {
			reject({
				statusCode: 400,
				error: new Error('"commentBody" should be provided.'),
				safeMessage: true
			});
			return;
		}

		if (req.query.commentBody.length > 2000) {
			reject({
				statusCode: 400,
				error: new Error('"commentBody" too long. The maximum length is 2000 characters.'),
				safeMessage: true
			});
			return;
		}



		let sessionId;
		if (req.cookies && req.cookies['FTSession']) {
			sessionId = req.cookies['FTSession'];
		}
		if (req.query.sessionId) {
			sessionId = req.query.sessionId;
		}


		if (sessionId) {
			sudsService.getAuth(sessionId).then((auth) => {
				if (auth.token) {
					postComment({
						collectionId: collectionId,
						commentBody: req.query.commentBody,
						token: auth.token
					}).then((postData) => {
						resolve(postData);

						if (auth.settings && (auth.settings.emailautofollow === "on" || auth.settings.emailautofollow === true)) {
							livefyreService.unfollowCollection({
								collectionId: collectionId,
								token: auth.token
							});
						}
					}).catch(reject);
				} else {
					reject({
						statusCode: 401,
						invalidSession: true
					});
				}
			}).catch((err) => {
				if (err.statusCode === 401) {
					reject({
						statusCode: 401,
						invalidSession: true
					});
				} else {
					reject(err);
				}
			});
		} else {
			reject({
				statusCode: 401,
				invalidSession: true
			});
		}
	});

	promise.then((data) => {
		sendActionSuccessResponse(req, res, data);
	}).catch((err) => {
		sendActionFailResponse(req, res, err);
	});
};





const deleteComment = function (config) {
	return livefyreService.deleteComment({
		collectionId: config.collectionId,
		commentId: config.commentId,
		token: config.token
	}).then((commentData) => {
		return {
			status: commentData.status,
			code: commentData.code
		};
	});
};

exports.deleteComment = function (req, res) {
	const promise = new Promise((resolve, reject) => {
		let collectionId = parseInt(req.query.collectionId, 10);
		if (typeof collectionId !== 'number' || isNaN(collectionId)) {
			reject({
				statusCode: 400,
				error: new Error('"collectionId" should be a number.'),
				safeMessage: true
			});
			return;
		}

		let commentId = parseInt(req.query.commentId, 10);
		if (typeof commentId !== 'number' || isNaN(commentId)) {
			reject({
				statusCode: 400,
				error: new Error('"commentId" should be a number.'),
				safeMessage: true
			});
			return;
		}


		let sessionId;
		if (req.cookies && req.cookies['FTSession']) {
			sessionId = req.cookies['FTSession'];
		}
		if (req.query.sessionId) {
			sessionId = req.query.sessionId;
		}

		if (sessionId) {
			sudsService.getAuth(sessionId).then((auth) => {
				if (auth.token) {
					deleteComment({
						collectionId: collectionId,
						commentId: commentId,
						token: auth.token
					}).then(resolve).catch(reject);
				} else {
					reject({
						statusCode: 401,
						invalidSession: true
					});
				}
			}).catch((err) => {
				if (err.statusCode === 401) {
					reject({
						statusCode: 401,
						invalidSession: true
					});
				} else {
					reject(err);
				}
			});
		} else {
			reject({
				statusCode: 401,
				invalidSession: true
			});
		}
	});


	promise.then((data) => {
		sendActionSuccessResponse(req, res, data);
	}).catch((err) => {
		sendActionFailResponse(req, res, err);
	});
};

exports.closeCollection = function (req, res) {
	if (!req.headers['x-api-key']) {
		res.status(400).send({
			success: false,
			status: "error",
			error: 'The API key is missing.'
		});
		return;
	}

	apiKeys.validate(req.headers['x-api-key']).catch((err) => {
		res.status(503).send({
			success: false,
			status: "error",
			error: 'The system cannot handle requests at the moment.'
		});
		return;
	}).then((validated) => {
		if (!validated) {
			res.status(401).send({
				success: false,
				status: "error",
				error: 'The API key is invalid.'
			});
			return;
		} else {
			if (!req.query.articleId && !req.body.articleId) {
				res.status(400).send({
					success: false,
					status: "error",
					error: '"articleId" should be provided.'
				});
				return;
			}

			const articleId = req.query.articleId || req.body.articleId;

			let collectionDataStore = new CollectionDataStore(articleId);
			collectionDataStore.getCollectionId().then((collectionId) => {
				livefyreService.closeCollection(collectionId).then(() => {
					res.send({
						success: true,
						status: "ok"
					});
				}).catch((err) => {
					res.status(err.statusCode || 503).send({
						success: false,
						status: "error",
						error: err.statusCode === 404 ? "Collection not found" : "Error occurred while determining the collection ID."
					});
				});
			}).catch((err) => {
				res.status(err.statusCode || 503).send({
					success: false,
					status: "error",
					error: err.statusCode === 404 ? "Collection not found" : "Error occurred while determining the collection ID."
				});
			});
		}
	});
};
