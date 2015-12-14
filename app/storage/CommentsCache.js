"use strict";

const db = require('../services/db');
const livefyreService = require('../services/livefyre');
const consoleLogger = require('../utils/consoleLogger');
const mongoSanitize = require('mongo-sanitize');
const EventEmitter = require('events');
const env = require('../../env');
const _ = require('lodash');
const Timer = require('../utils/Timer');

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

				let timer = new Timer();

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

						rejectInProgress(err);
					});
				});

				promiseInProgress.then((data) => {
					storeEvents.emit('storedDataFetched_resolve', data);
				}).catch((err) => {
					storeEvents.emit('storedDataFetched_reject', err);
				}).then(() => {
					fetchingStoreInProgress = false;

					let elapsedTime = timer.getElapsedTime();
					if (elapsedTime > 5000) {
						consoleLogger.warn('CollectionDataStore.getStoredData: service high response time', elapsedTime + 'ms');
					} else {
						consoleLogger.info('CollectionDataStore.getStoredData: service response time', elapsedTime + 'ms');
					}
				});
			}
		});

		return promise;
	}



	const sanitizeData = function (data) {
		if (data instanceof Array && data.length) {
			let newData = [];

			data.forEach((item) => {
				newData.push(sanitizeData(item));
			});

			return newData;
		} else if (data && typeof data === 'object' && Object.keys(data).length) {
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
		return new Promise((resolve, reject) => {
			getStoredData().then((storedData) => {
				if (storedData && storedData.totalPages) {
					resolve(storedData.totalPages);
				} else {
					livefyreService.getCollectionInfoPlus({
						articleId: articleId,
						siteId: siteId
					}).then((livefyreCollectionDetails) => {
						upsertStoredData({
							totalPages: livefyreCollectionDetails.collectionSettings.archiveInfo.nPages
						});

						resolve(livefyreCollectionDetails.collectionSettings.archiveInfo.nPages);
					}).catch(reject);
				}
			}).catch(() => {
				livefyreService.getCollectionInfoPlus({
					articleId: articleId,
					siteId: siteId
				}).then((livefyreCollectionDetails) => {
					resolve(livefyreCollectionDetails.collectionSettings.archiveInfo.nPages);
				}).catch(reject);
			});
		});
	};

	const preprocessComments = function (commentsData) {
		let comments = commentsData.content;
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
			}

			if (comment.event > maxEvent) {
				maxEvent = comment.event;
			}
		});

		return {
			comments: processedComments,
			lastEvent: maxEvent
		};
	};


	const getCommentsByPage = function (config) {
		return new Promise((resolve, reject) => {
			if (config.totalPages === 0 && config.pageNumber === 0) {
				resolve({
					comments: [],
					lastEvent: 0,
					totalPages: 0,
					nextPage: null
				});
			} else {
				if (config.pageNumber < config.totalPages) {
					getStoredData().then((storedData) => {
						if (storedData && storedData.comments && storedData.comments['page' + config.pageNumber]) {
							resolve(storedData.comments['page' + config.pageNumber]);
						} else {
							livefyreService.getCommentsByPage({
								pageNumber: config.pageNumber,
								articleId: articleId,
								siteId: siteId
							}).then((response) => {
								let commentData = _.extend(preprocessComments(response), {
									totalPages: config.totalPages,
									nextPage: (config.pageNumber === 0 ? null : config.pageNumber - 1)
								});

								let dataToUpsert = {};
								dataToUpsert['comments.page' + config.pageNumber] = commentData;
								upsertStoredData(dataToUpsert);

								resolve(commentData);
							}).catch(reject);
						}
					}).catch(() => {
						livefyreService.getCommentsByPage({
							pageNumber: config.pageNumber,
							articleId: articleId,
							siteId: siteId
						}).then((response) => {
							resolve(_.extend(preprocessComments(response), {
								totalPages: config.totalPages,
								nextPage: (config.pageNumber === 0 ? null : config.pageNumber - 1)
							}));
						}).catch(reject);
					});
				} else {
					reject({
						statusCode: 404,
						error: new Error("Page does not exist.")
					});
				}
			}
		});
	};


	this.getCommentsByPage = function (pageNumber) {
		return new Promise((resolve, reject) => {
			let fetchInit = false;

			if (!articleId || !siteId) {
				reject({
					statusCode: 503,
					error: new Error("`articleId` or `siteId` are not provided.")
				});
				return;
			}

			if (typeof pageNumber !== 'number') {
				fetchInit = true;
			}


			getTotalPages(storedData).then((totalPages) => {
				if (fetchInit) {
					if (totalPages <= 1) {
						getCommentsByPage({
							totalPages: totalPages,
							pageNumber: 0
						}).then((commentsData) => {
							resolve(commentsData);
						}).catch(reject);
					} else {
						Promise.all([
							getCommentsByPage({
								totalPages: totalPages,
								pageNumber: totalPages - 1
							}),
							getCommentsByPage({
								totalPages: totalPages,
								pageNumber: totalPages - 2
							})
						]).then((results) => {
							let commentData = {
								comments: [].concat(results[0].comments).concat(results[1].comments),
								lastEvent: results[0].lastEvent,
								totalPages: totalPages,
								nextPage: results[1].nextPage
							};

							resolve(commentData);
						}).catch(reject);
					}
				} else {
					getCommentsByPage({
						totalPages: totalPages,
						pageNumber: pageNumber
					}).then((commentsData) => {
						resolve(commentsData);
					}).catch(reject);
				}
			}).catch(reject);
		});
	};


	this.destroy = function () {
		storedData = null;
	};
};
module.exports = CommentsCache;
