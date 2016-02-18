"use strict";

const db = require('../services/db');
const livefyreService = require('../services/livefyre');
const sudsService = require('../services/suds');
const spamFilter = require('../services/spamFilter');
const consoleLogger = require('../utils/consoleLogger');
const mongoSanitize = require('mongo-sanitize');
const EventEmitter = require('events');
const env = require('../../env');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const Timer = require('../utils/Timer');


var CollectionDataStore = function (articleId) {
	var storedData = null;
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

				let timer = new Timer();

				const promiseInProgress = new Promise((resolveInProgress, rejectInProgress) => {
					db.getConnection(env.mongo.uri).then((connection) => {
						connection.collection(mongoCollection).find({
							_id: mongoSanitize(articleId)
						}).maxTimeMS(env.timeouts.queries).toArray(function (errDb, data) {
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




	const getLivefyreCollectionDetails = function (config) {
		return livefyreService.getCollectionInfoPlus({
			articleId: config.articleId,
			siteId: config.siteId
		});
	};

	const pollLivefyreCollectionDetailsAfterCreation = function (config, noOfTry) {
		noOfTry = noOfTry || 0;

		return getLivefyreCollectionDetails(config).catch((err) => {
			if (noOfTry < 4) {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						pollLivefyreCollectionDetailsAfterCreation(config, noOfTry + 1).then(resolve).catch(reject);
					}, (noOfTry + 1) * 1000);
				});
			} else {
				throw err;
			}
		});
	};



	const getSudsCollectionDetails = function (config) {
		return sudsService.getCollectionDetails(config).then((collectionDetails) => {
			if (collectionDetails.notAllowedToCreateCollection === true) {
				return {
					notAllowedToCreateCollection: true
				};
			} else if (collectionDetails.unclassifiedArticle === true) {
				return {
					unclassified: true
				};
			} else if (collectionDetails.siteId && collectionDetails.collectionMeta) {
				return collectionDetails;
			} else {
				throw {
					statusCode: 503,
					error: new Error("Incorrect collection details received."),
					responseBody: collectionDetails
				};
			}
		});
	};



	const createCollection = function (config) {
		return livefyreService.createCollection(config).catch((err) => {
			if (err.statusCode === 409) {
				return;
			} else {
				throw err;
			}
		});
	};


	const fetchCollectionDetails = function (config) {
		return getSudsCollectionDetails(config).then((sudsCollectionDetails) => {
			if (sudsCollectionDetails.siteId && sudsCollectionDetails.collectionMeta) {
				if (sudsCollectionDetails.collectionExists !== true) {
					return createCollection(_.pick(sudsCollectionDetails, ['siteId', 'collectionMeta', 'checksum'])).then(() => {
						consoleLogger.log(config.articleId, 'collection created');

						return _.extend({
							collectionCreated: true
						}, sudsCollectionDetails);
					});
				} else {
					return sudsCollectionDetails;
				}
			} else {
				return sudsCollectionDetails;
			}
		}).then((sudsCollectionDetails) => {
			if (sudsCollectionDetails.siteId) {
				let functionToGetLfCollectionDetails;

				if (sudsCollectionDetails.collectionCreated) {
					functionToGetLfCollectionDetails = pollLivefyreCollectionDetailsAfterCreation;
				} else {
					functionToGetLfCollectionDetails = getLivefyreCollectionDetails;
				}

				return functionToGetLfCollectionDetails({
					articleId: config.articleId,
					siteId: sudsCollectionDetails.siteId
				}).then((livefyreCollectionDetails) => {
					if (sudsCollectionDetails.collectionCreated) {
						let collectionMetaDecoded = jwt.decode(sudsCollectionDetails.collectionMeta);

						if (collectionMetaDecoded && collectionMetaDecoded.url && collectionMetaDecoded.url.match(/(.*)marketslive(.*)/)) {
							spamFilter.whitelistCollection(livefyreCollectionDetails.collectionSettings.collectionId);
						}
					}

					return {
						collectionId: livefyreCollectionDetails.collectionSettings.collectionId,
						siteId: sudsCollectionDetails.siteId
					};
				});
			} else {
				return sudsCollectionDetails;
			}
		});
	};

	this.getCollectionDetails = function (config) {
		const promise = new Promise((resolve, reject) => {
			if (!config || typeof config !== 'object' || !config.url || !config.title) {
				reject({
					statusCode: 400,
					error: new Error("'url' and 'title' are not provided.")
				});
				return;
			}


			if (!articleId) {
				reject({
					statusCode: 503,
					error: new Error("Article ID is not provided.")
				});
				return;
			}


			if (config.articleId && config.articleId !== articleId) {
				consoleLogger.error(articleId, "ArticleID provided to the function is in conflict with the CollectionDataStore's articleId");
				reject({
					statusCode: 503,
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


	this.destroy = function () {
		storedData = null;
	};
};
module.exports = CollectionDataStore;
