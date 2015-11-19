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

var CollectionDataStore = function (articleId) {
	var storedData = null;
	var self = this;
	var storeEvents = new EventEmitter();

	const mongoCollection = 'collections';


	let toBeRefreshed;
	var fetchingStoreInProgress = false;
	function getStoredData () {
		const promise = new Promise((resolve, reject) => {
			if (storedData && !toBeRefreshed) {
				consoleLogger.log(articleId, 'cached data retrieved from memory');
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
							_id: mongoSanitize(articleId)
						}).toArray(function (errDb, data) {
							if (errDb) {
								consoleLogger.warn(articleId, 'cache retrieval failed', errDb);

								rejectInProgress({
									statusCode: 503,
									error: errDb
								});
								return;
							}

							if (data && data.length) {
								storedData = data[0];
								toBeRefreshed = false;

								consoleLogger.log(articleId, 'cached data retrieved');
								consoleLogger.debug(articleId, storedData);

								resolveInProgress(storedData);
							} else {
								consoleLogger.log(articleId, 'no cached data found');
								resolveInProgress(null);
							}
						});
					}).catch((err) => {
						consoleLogger.warn(articleId, 'error retrieving the cache', err);

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
				consoleLogger.log(articleId, 'upsert cache');
				consoleLogger.debug(articleId, 'data:', sanitizedData);

				connection.collection(mongoCollection).update({
					_id: mongoSanitize(articleId)
				}, {
					$set: sanitizedData
				}, {
					upsert: true
				}, function (errUpsert) {
					if (errUpsert) {
						consoleLogger.warn(articleId, 'upsert failed', errUpsert);
						reject({
							statusCode: 503,
							error: errUpsert
						});
						return;
					}

					// reset storage cache
					toBeRefreshed = true;

					resolve();
				});
			}).catch((err) => {
				consoleLogger.warn(articleId, 'upsert failed', err);

				reject(err);
			});
		});

		return promise;
	}





	const getLivefyreCollectionDetails = function (config, noOfTry) {
		noOfTry = noOfTry || 0;

		const promise = new Promise((resolve, reject) => {
			livefyreService.getCollectionInfoPlus({
				articleId: config.articleId,
				siteId: config.siteId
			}).then((livefyreCollectionDetails) => {
				resolve(livefyreCollectionDetails);
			}).catch((err) => {
				if (noOfTry < 4) {
					setTimeout(() => {
						getLivefyreCollectionDetails(config, noOfTry + 1).then(resolve).catch(reject);
					}, (noOfTry + 1) * 1000);
				} else {
					reject(err);
				}
			});
		});

		return promise;
	};

	const getSudsCollectionDetails = function (config) {
		const promise = new Promise((resolve, reject) => {
			sudsService.getCollectionDetails(config).then((collectionDetails) => {
				if (collectionDetails.notAllowedToCreateCollection === true) {
					resolve({
						notAllowedToCreateCollection: true
					});
				} else if (collectionDetails.unclassifiedArticle === true) {
					resolve({
						unclassified: true
					});
				} else if (collectionDetails.siteId && collectionDetails.collectionMeta) {
					resolve(collectionDetails);
				} else {
					reject({
						statusCode: 503,
						error: new Error("Incorrect collection details received."),
						responseBody: collectionDetails
					});
				}
			}).catch(reject);
		});

		return promise;
	};



	const createCollection = function (config) {
		const promise = new Promise((resolve, reject) => {
			livefyreService.createCollection(config).then(resolve).catch((err) => {
				if (err.statusCode === 409) {
					resolve();
				} else {
					reject(err);
				}
			});
		});

		return promise;
	};


	const fetchCollectionDetails = function (config) {
		const promiseSuds = new Promise((resolve, reject) => {
			getSudsCollectionDetails(config).then((sudsCollectionDetails) => {
				if (sudsCollectionDetails.siteId && sudsCollectionDetails.collectionMeta) {
					if (sudsCollectionDetails.collectionExists !== true) {
						createCollection(_.pick(sudsCollectionDetails, ['siteId', 'collectionMeta', 'checksum'])).then(() => {
							consoleLogger.log(config.articleId, 'collection created');

							resolve(sudsCollectionDetails);
						}).catch(reject);
					} else {
						resolve(sudsCollectionDetails);
					}
				} else {
					resolve(sudsCollectionDetails);
				}
			}).catch(reject);
		});

		const promise = new Promise((resolve, reject) => {
			promiseSuds.then((sudsCollectionDetails) => {
				if (sudsCollectionDetails.siteId) {
					getLivefyreCollectionDetails({
						articleId: config.articleId,
						siteId: sudsCollectionDetails.siteId
					}).then((livefyreCollectionDetails) => {
						resolve({
							collectionId: livefyreCollectionDetails.collectionSettings.collectionId,
							totalPages: (livefyreCollectionDetails.collectionSettings.archiveInfo.nPages > 1 ? livefyreCollectionDetails.collectionSettings.archiveInfo.nPages - 1 : livefyreCollectionDetails.collectionSettings.archiveInfo.nPages),
							lfTotalPages: livefyreCollectionDetails.collectionSettings.archiveInfo.nPages,
							siteId: sudsCollectionDetails.siteId
						});
					}).catch(reject);
				} else {
					resolve(sudsCollectionDetails);
				}
			}).catch(reject);
		});

		return promise;
	};

	this.getCollectionDetails = function (config) {
		const promise = new Promise((resolve, reject) => {
			if (!config.articleId || !config.url || !config.title) {
				reject({
					statusCode: 400,
					error: new Error("'articleId', 'url' and 'title' are not provided.")
				});
				return;
			}


			if (config.articleId !== articleId) {
				consoleLogger.error(articleId, "ArticleID provided to the function is in conflict with the CollectionDataStore's articleId");
				reject({
					statusCode: 400,
					error: new Error("Article ID provided is in conflict with the data stores's ID.")
				});
				return;
			}
			config.articleId = articleId;

			getStoredData().then((storedData) => {
				if (storedData && storedData.collectionId && storedData.siteId) {
					resolve({
						siteId: storedData.siteId,
						collectionId: storedData.collectionId
					});
				} else {
					fetchCollectionDetails(config).then((collectionDetails) => {
						if (collectionDetails.siteId && collectionDetails.collectionId) {
							let returnData = {
								siteId: collectionDetails.siteId,
								collectionId: collectionDetails.collectionId
							};

							resolve(returnData);
							upsertStoredData(returnData);
						} else {
							resolve(collectionDetails);
						}
					}).catch(reject);
				}
			}).catch((err) => {
				// fetch

				fetchCollectionDetails(config).then((collectionDetails) => {
					if (collectionDetails.siteId && collectionDetails.collectionId) {
						let returnData = {
							siteId: collectionDetails.siteId,
							collectionId: collectionDetails.collectionId
						};

						resolve(returnData);
					} else {
						resolve(collectionDetails);
					}
				}).catch(reject);
			});
		});

		return promise;
	};







	const preprocessComments = function (comments, authors) {
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
			maxEvent: maxEvent
		};
	};


	const fetchCommentsByPage = function (config) {
		const promise = new Promise((resolve, reject) => {
			if (config.pageNumber === 0) {
				async.parallel({
					pageLast: (callback) => {
						livefyreService.getCommentsByPage({
							pageNumber: config.lfTotalPages - 1,
							articleId: config.articleId,
							siteId: config.siteId
						}).then((response) => {
							callback(null, preprocessComments(response.content, response.authors));
						}).catch((err) => {
							callback(err);
						});
					},
					pageBeforeLast: (callback) => {
						livefyreService.getCommentsByPage({
							pageNumber: config.lfTotalPages - 2,
							articleId: config.articleId,
							siteId: config.siteId
						}).then((response) => {
							callback(null, preprocessComments(response.content, response.authors));
						}).catch((err) => {
							callback(err);
						});
					}
				}, (err, results) => {
					if (err) {
						reject(err);
						return;
					}

					resolve({
						comments: [].concat(results.pageLast.comments).concat(results.pageBeforeLast.comments),
						maxEvent: results.pageLast.maxEvent > results.pageBeforeLast.maxEvent ? results.pageLast.maxEvent : results.pageBeforeLast.maxEvent
					});
				});
			}
		});

		return promise;
	};


	this.getCommentsByPage = function (config) {
		const promise = new Promise((resolve, reject) => {
			self.getCollectionDetails(config).then((collectionDetails) => {
				if (collectionDetails.notAllowedToCreateCollection || collectionDetails.unclassified) {
					resolve(collectionDetails);
				} else if (collectionDetails.collectionId) {

				} else {
					reject({
						statusCode: 404,
						error: new Error("Not found")
					});
				}
			}).catch(() => {

			});
		});

		return promise;
	};


	this.destroy = function () {
		storedData = null;
	};
};
module.exports = CollectionDataStore;
