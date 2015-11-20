"use strict";

const db = require('../services/db');
const livefyreService = require('../services/livefyre');
const sudsService = require('../services/suds');
const consoleLogger = require('../utils/consoleLogger');
const mongoSanitize = require('mongo-sanitize');
const EventEmitter = require('events');
const env = require('../../env');
const _ = require('lodash');
const async = require('async');

const CommentsCache = function (articleId, siteId) {
	let storedData = null;
	let storeEvents = new EventEmitter();
	let atLeastOneUpdateMade = false;
	const mongoCollection = 'comments';

	let combinedId = articleId + '-' + siteId;


	let toBeRefreshed;
	let fetchingStoreInProgress = false;
	function getStoredData () {
		const promise = new Promise((resolve, reject) => {
			if (storedData && !toBeRefreshed) {
				consoleLogger.log(combinedId, 'cached data retrieved from memory');

				resolve(storedData);
				return;
			}


			storeEvents.once('storedDataFetched_resolve', function (data) {
				resolve(data);
			});

			storeEvents.once('storedDataFetched_reject', function (err) {
				reject(err);
			});


			if (!fetchingStoreInProgress) {
				fetchingStoreInProgress = true;

				const promiseInProgress = new Promise((resolveInProgress, rejectInProgress) => {
					db.getConnection(env.mongo.uri).then((connection) => {
						connection.collection(mongoCollection).find({
							_id: mongoSanitize(combinedId)
						}).toArray(function (errDb, data) {
							if (errDb) {
								consoleLogger.warn(combinedId, 'cache retrieval failed', errDb);

								rejectInProgress({
									statusCode: 503,
									error: errDb
								});
								return;
							}

							if (data && data.length) {
								storedData = data[0];
								toBeRefreshed = false;

								consoleLogger.log(combinedId, 'cached data retrieved');
								consoleLogger.debug(combinedId, storedData);

								resolveInProgress(storedData);
							} else {
								consoleLogger.log(combinedId, 'no cached data found');
								resolveInProgress(null);
							}
						});
					}).catch((err) => {
						consoleLogger.warn(combinedId, 'error retrieving the cache', err);

						fetchingStoreInProgress = false;
						rejectInProgress(err);
					});
				});

				promiseInProgress.then((data) => {
					storeEvents.emit('storedDataFetched_resolve', data);
				}).catch((err) => {
					storeEvents.emit('storedDataFetched_reject', err);
				});
			}
		});

		return promise;
	}



	const sanitizeData = function (data) {
		if (data && typeof data === 'object' && Object.keys(data).length) {
			let keys = Object.keys(data);
			let newData = {};

			keys.forEach((key) => {
				newData[mongoSanitize(key)] = sanitizeData(data[key]);
			});

			return newData;
		} else {
			return data;
		}
	};

	function upsertStoredData (data) {
		const promise = new Promise((resolve, reject) => {
			var sanitizedData = sanitizeData(data);

			db.getConnection(env.mongo.uri).then((connection) => {
				consoleLogger.log(combinedId, 'upsert cache');
				consoleLogger.debug(combinedId, 'data:', sanitizedData);

				connection.collection(mongoCollection).update({
					_id: mongoSanitize(combinedId)
				}, {
					$set: sanitizedData
				}, {
					upsert: true
				}, function (errUpsert, result) {
					if (errUpsert) {
						consoleLogger.warn(combinedId, 'upsert failed', errUpsert);
						reject({
							statusCode: 503,
							error: errUpsert
						});
						return;
					}

					// reset storage cache
					toBeRefreshed = true;

					if (!atLeastOneUpdateMade && result !== 1) {
						atLeastOneUpdateMade = true;

						let expireAt = new Date(new Date().getTime() + env.cache.commentsExpireInMinutes * 60 * 1000);

						// insert, should set an expire
						consoleLogger.log(combinedId, 'upsert', 'new entry, set expiration to', expireAt);

						connection.collection(mongoCollection).update({
							_id: mongoSanitize(combinedId)
						}, {
							$set: {
								'expireAt': expireAt
							}
						});
					}

					resolve();
				});
			}).catch((err) => {
				consoleLogger.warn(combinedId, 'upsert failed', err);

				reject(err);
			});
		});

		return promise;
	}



	const getTotalPages = function () {
		return livefyreService.getCollectionInfoPlus({
			articleId: articleId,
			siteId: siteId
		}).then((livefyreCollectionDetails) => {
			return livefyreCollectionDetails.collectionSettings.archiveInfo.nPages;
		});
	};

	const preprocessComments = function (commentsData) {
		let comments = commentsData.comments;
		let authors = commentsData.authors;

		let processedComments = [];
		let maxEvent = 0;

		comments.forEach((comment) => {
			if (comment.vis === 1) {
				processedComments.unshift({
					parentId: comment.content.parentId,
					author: {
						id: authors[comment.content.authorId].id,
						displayName: authors[comment.content.authorId].displayName,
						tags: authors[comment.content.authorId].tags,
						type: authors[comment.content.authorId].type
					},
					content: comment.content.bodyHtml,
					timestamp: comment.content.createdAt,
					commentId: comment.content.id,
					visibility: comment.vis
				});

				if (comment.event > maxEvent) {
					maxEvent = comment.event;
				}
			}
		});

		return {
			comments: processedComments,
			lastEvent: maxEvent
		};
	};


	const getCommentsByPage = function (config) {
		const promise = new Promise((resolve, reject) => {
			let totalPages = (config.lfTotalPages > 1 ? config.lfTotalPages - 1 : config.lfTotalPages);

			if (config.pageNumber <= config.lfTotalPages) {
				if (config.lfTotalPages === 0) {
					resolve([]);
				} else {
					if (config.pageNumber === 0 && config.lfTotalPages > 1) {
						async.parallel({
							pageLast: (callback) => {
								livefyreService.getCommentsByPage({
									pageNumber: config.lfTotalPages - 1,
									articleId: articleId,
									siteId: siteId
								}).then(preprocessComments).then((commentsProcessed) => {
									callback(null, commentsProcessed);
								}).catch((err) => {
									callback(err);
								});
							},
							pageBeforeLast: (callback) => {
								livefyreService.getCommentsByPage({
									pageNumber: config.lfTotalPages - 2,
									articleId: articleId,
									siteId: siteId
								}).then(preprocessComments).then((commentsProcessed) => {
									callback(null, commentsProcessed);
								}).catch((err) => {
									callback(err);
								});
							}
						}, function (err, results) {
							if (err) {
								reject(err);
								return;
							}

							resolve({
								comments: [].concat(results.pageLast.comments).concat(results.pageBeforeLast.comments),
								lastEvent: results.pageLast.lastEvent > results.pageBeforeLast.lastEvent ? results.pageLast.lastEvent : results.pageBeforeLast.lastEvent,
								totalPages: totalPages,
								nextPage: (config.pageNumber >= totalPages-1 ? null : config.pageNumber + 1)
							});
						});
					} else {
						let pageNumber;
						if (config.pageNumber === 0 && config.lfTotalPages === 1) {
							pageNumber = 0;
						} else {
							pageNumber = config.lfTotalPages - config.pageNumber - 2;
						}

						if (pageNumber >= 0) {
							livefyreService.getCommentsByPage({
								pageNumber: pageNumber,
								articleId: articleId,
								siteId: siteId
							}).then((response) => {
								resolve(_.extend(preprocessComments(response.content, response.authors), {
									totalPages: totalPages,
									nextPage: (config.pageNumber >= totalPages-1 ? null : config.pageNumber + 1)
								}));
							}).catch(reject);
						} else {
							reject({
								statusCode: 404,
								error: new Error("Page does not exist.")
							});
						}
					}
				}
			} else {
				reject({
					statusCode: 404,
					error: new Error("Page does not exist.")
				});
			}
		});

		return promise;
	};


	this.getCommentsByPage = function (pageNumber) {
		const promise = new Promise((resolve, reject) => {
			if (typeof pageNumber !== 'number') {
				reject({
					statusCode: 400,
					error: new Error("Page number should be numeric.")
				});
				return;
			}

			getStoredData().then((storedData) => {
				if (storedData && storedData.comments && storedData.comments['page' + pageNumber]) {
					resolve(storedData.comments['page' + pageNumber]);
				} else {
					if (storedData && storedData.lfTotalPages) {
						getCommentsByPage({
							lfTotalPages: storedData.lfTotalPages,
							pageNumber: pageNumber
						}).then((commentsData) => {
							resolve(commentsData);

							let dataToUpsert = {};
							dataToUpsert['cache.comments.' + pageNumber] = commentsData;
							upsertStoredData(dataToUpsert);
						}).catch(reject);
					} else {
						getTotalPages().then((lfTotalPages) => {
							upsertStoredData({
								lfTotalPages: lfTotalPages
							});

							getCommentsByPage({
								lfTotalPages: lfTotalPages,
								pageNumber: pageNumber
							}).then((commentsData) => {
								resolve(commentsData);

								let dataToUpsert = {};
								dataToUpsert['cache.comments.' + pageNumber] = commentsData;
								upsertStoredData(dataToUpsert);
							}).catch(reject);
						}).catch(reject);
					}
				}
			}).catch(reject);
		});

		return promise;
	};


	this.destroy = function () {
		storedData = null;
	};
};
module.exports = CommentsCache;
