"use strict";

const _ = require('lodash');
const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const NeedleMock = require('../../../mocks/needle');
const MongodbMock = require('../../../mocks/mongodb');

consoleLogger.disable();

const env = {
	mongo: {
		uri: 'mongo-connection'
	},
	livefyre: {
		network: {
			name: 'ft123'
		},
		api: {
			createCollectionUrl: 'http://{networkName}.fyre.co/{siteId}/commentsByPageUrl',
			collectionInfoPlusUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/collectionInfoPlusUrl'
		}
	},
	suds: {
		api: {
			getCollectionDetails: 'http://suds.ft.com/getCollectionDetails'
		}
	},
	'@global': true
};


const validSessionId = 'r42rf34f34f';
const articles = {
	unclassified: {
		id: 'e054489d-cdfd-439b-8a7f-3dde77d0b374',
		url: 'http://ft.com/e054489d-cdfd-439b-8a7f-3dde77d0b374.html',
		title: 'Unclassified article',
		sudsInfo: {
			unclassifiedArticle: true
		}
	},
	noCollection: {
		id: 'f243f394-a67f-4331-920d-aeb829b5189b',
		url: 'http://ft.com/f243f394-a67f-4331-920d-aeb829b5189b.html',
		title: 'No collection article',
		sudsInfo: {
			siteId: 524234,
			collectionExists: false
		}
	},
	noCollection2: {
		id: 'f79caaf4-7b8e-429d-9619-e702bd078cdb',
		url: 'http://ft.com/f79caaf4-7b8e-429d-9619-e702bd078cdb.html',
		title: 'No collection article 2',
		sudsInfo: {
			siteId: 523456,
			collectionExists: false
		}
	},
	collectionExists: {
		id: '201d31cc-dd6c-41aa-a29c-0a70eca63106',
		url: 'http://ft.com/201d31cc-dd6c-41aa-a29c-0a70eca63106.html',
		title: 'Collection exists article',
		sudsInfo: {
			siteId: 534534,
			collectionExists: true
		},
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				collectionId: 523438
			}
		}
	},
	collectionExists2: {
		id: '6a67cfad-22ac-4ae4-b12d-071666452fbb',
		url: 'http://ft.com/6a67cfad-22ac-4ae4-b12d-071666452fbb.html',
		title: 'Collection exists article 2',
		sudsInfo: {
			siteId: 523423,
			collectionExists: true
		},
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				collectionId: 634534
			}
		}
	},
	cached: {
		id: '0d08da26-819c-4b37-a198-53b77c6a80b1',
		url: 'http://ft.com/0d08da26-819c-4b37-a198-53b77c6a80b1.html',
		title: 'Cached article',
		cache: {
			siteId: 423423,
			collectionId: 52341223
		}
	}
};

const byArticleId = {};
Object.keys(articles).forEach((key) => {
	byArticleId[articles[key].id] = articles[key];
});


const collections = {};
Object.keys(articles).forEach((key) => {
	if (articles[key].collectionInfo && articles[key].sudsInfo && articles[key].sudsInfo.siteId) {
		collections[articles[key].id + '-' + articles[key].sudsInfo.siteId] = articles[key].collectionInfo;
	}
});

const collectionsCreated = {};
const collectionsCreatedRespondedWithError = {};

const needleMock = new NeedleMock({
	items: [
		{
			url: env.livefyre.api.createCollectionUrl,
			handler: function (config) {
				if (!config.postData) {
					config.callback(null, {
						statusCode: 400
					});
				}

				if (!config.params || !config.params.json) {
					config.callback(null, {
						statusCode: 400
					});
				}

				if (config.matches.urlParams.networkName !== env.livefyre.network.name) {
					config.callback(new Error("Network is not correct."));
					return;
				}

				if (config.postData.collectionMeta && config.postData.collectionMeta.indexOf('notfound') !== -1) {
					config.callback(null, {
						statusCode: 404
					});
				}

				if (config.postData.collectionMeta && config.postData.collectionMeta.indexOf('down') !== -1) {
					config.callback(new Error("Service down."));
					return;
				}

				config.history[config.postData.collectionMeta] = {
					postData: config.postData,
					siteId: config.matches.urlParams.siteId
				};

				let meta = JSON.parse(config.postData.collectionMeta);
				collectionsCreated[meta.articleId + '-' + meta.siteId] = {
					headDocument: [],
					collectionSettings: {
						collectionId: meta.articleId + '-' + meta.siteId
					}
				};

				config.callback(null, {
					statusCode: 200,
					body: {
						"status": "ok"
					}
				});
			}
		},
		{
			url: env.livefyre.api.collectionInfoPlusUrl,
			handler: function (config) {
				let articleId = new Buffer(config.matches.urlParams.articleIdBase64, 'base64').toString();

				if (config.matches.urlParams.networkName !== env.livefyre.network.name) {
					config.callback(new Error("Network is not correct."));
					return;
				}

				if (articleId && articleId.indexOf('down') !== -1) {
					config.callback(new Error("Service down"));
					return;
				}

				let collection;

				collection = collections[articleId + '-' + config.matches.urlParams.siteId];
				if (collection) {
					config.callback(null, {
						statusCode: 200,
						body: _.extend({
							code: 200,
							status: "ok"
						}, collection)
					});
					return;
				}


				collection = collectionsCreated[articleId + '-' + config.matches.urlParams.siteId];
				if (collection) {
					if (collectionsCreatedRespondedWithError[articleId + '-' + config.matches.urlParams.siteId]) {
						config.callback(null, {
							statusCode: 200,
							body: _.extend({
								code: 200,
								status: "ok"
							}, collection)
						});
						return;
					} else {
						collectionsCreatedRespondedWithError[articleId + '-' + config.matches.urlParams.siteId] = true;
					}
				}

				config.callback(null, {
					statusCode: 404
				});
			}
		},
		{
			url: env.suds.api.getCollectionDetails,
			handler: function (config) {
				if (config.matches.queryParams.articleId && config.matches.queryParams.articleId.indexOf('down') !== -1) {
					config.callback(new Error("Service down."));
					return;
				}

				if (!byArticleId[config.matches.queryParams.articleId]) {
					config.callback(null, {
						statusCode: 404
					});
					return;
				}

				config.history[config.matches.queryParams.articleId] = config.matches;

				let returnData = {};
				returnData = _.extend(returnData, byArticleId[config.matches.queryParams.articleId].sudsInfo);

				if (returnData.collectionExists === false && config.matches.queryParams.sessionId !== validSessionId) {
					returnData.notAllowedToCreateCollection = true;
				}

				returnData.collectionMeta = JSON.stringify({
					articleId: config.matches.queryParams.articleId,
					siteId: byArticleId[config.matches.queryParams.articleId].sudsInfo.siteId
				});

				config.callback(null, {
					statusCode: 200,
					body: returnData
				});
			}
		}
	],
	global: true
});

const mongodbMock = new MongodbMock({
	dbMock: {
		collections: [{
			_id: articles.cached.id,
			siteId: articles.cached.cache.siteId,
			collectionId: articles.cached.cache.collectionId
		}]
	},
	global: true
});


const CollectionDataStore = proxyquire('../../../app/storage/CollectionDataStore.js', {
	'needle': needleMock.mock,
	'../../env': env,
	mongodb: mongodbMock.mock
});

describe('CollectionDataStore', function () {
	describe('getCollectionDetails', function () {
		it('should return error if `articleId` is not provided', function () {
			let collectionDataStore = new CollectionDataStore();

			return collectionDataStore.getCollectionDetails({
				title: 'asd',
				url: 'http://example.com'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if `title` is not provided', function () {
			let collectionDataStore = new CollectionDataStore('id');

			return collectionDataStore.getCollectionDetails({
				url: 'http://example.com'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return error if `url` is not provided', function () {
			let collectionDataStore = new CollectionDataStore('id');

			return collectionDataStore.getCollectionDetails({
				title: 'asd'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return error if one of the services is down', function () {
			let collectionDataStore = new CollectionDataStore('service-down');

			return collectionDataStore.getCollectionDetails({
				title: 'asd',
				url: 'sdf'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if the articleIds (constructor vs method param) provided are not equal', function () {
			let collectionDataStore = new CollectionDataStore('articleId1');

			return collectionDataStore.getCollectionDetails({
				title: 'asd',
				url: 'sdf',
				articleId: 'articleId2'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if one the article is not found', function () {
			let collectionDataStore = new CollectionDataStore('notfound');

			return collectionDataStore.getCollectionDetails({
				title: 'asd',
				url: 'sdf'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return unclassified if it gets unclassified response from SUDS', function () {
			let collectionDataStore = new CollectionDataStore(articles.unclassified.id);

			return collectionDataStore.getCollectionDetails({
				title: articles.unclassified.title,
				url: articles.unclassified.url
			}).then((data) => {
				assert.deepEqual(data, {
					unclassified: true
				}, "Response is correct.");
			});
		});

		it('should return `notAllowedToCreateCollection` if it gets that flag from SUDS', function () {
			let collectionDataStore = new CollectionDataStore(articles.noCollection.id);

			return collectionDataStore.getCollectionDetails({
				title: articles.noCollection.title,
				url: articles.noCollection.url,
				sessionId: 'f23df243f'
			}).then((data) => {
				assert.deepEqual(data, {
					notAllowedToCreateCollection: true
				}, "Response is correct.");
			});
		});

		it('should not return `notAllowedToCreateCollection` if the session is valid, should create the collection, should fetch the result and should cache it', function () {
			let collectionDataStore = new CollectionDataStore(articles.noCollection2.id);

			let expectedCollectionId = articles.noCollection2.id + '-' + articles.noCollection2.sudsInfo.siteId;

			return new Promise((resolve, reject) => {
				collectionDataStore.getCollectionDetails({
					title: articles.noCollection2.title,
					url: articles.noCollection2.url,
					sessionId: validSessionId
				}).then((data) => {
					assert.ok(!data.notAllowedToCreateCollection, "Collection is allowed to be created.");
					assert.deepEqual(collectionsCreated[expectedCollectionId], {
						headDocument: [],
						collectionSettings: {
							collectionId: expectedCollectionId
						}
					}, "Collection successfully created.");
					assert.deepEqual(data, {
						collectionId: expectedCollectionId,
						siteId: articles.noCollection2.sudsInfo.siteId
					}, "Collection details successfully fetched after creation.");

					setTimeout(() => {
						var collectionCache = mongodbMock.findInDb('collections', {
							_id: articles.noCollection2.id
						});

						assert.equal(collectionCache.length, 1, "Cache entry created.");
						assert.deepEqual(collectionCache[0], {
							_id: articles.noCollection2.id,
							collectionId: expectedCollectionId,
							siteId: articles.noCollection2.sudsInfo.siteId
						}, "Collection details successfully cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should not return `notAllowedToCreateCollection` if the collection exists, should fetch the result and should cache it', function () {
			let collectionDataStore = new CollectionDataStore(articles.collectionExists.id);

			return new Promise((resolve, reject) => {
				collectionDataStore.getCollectionDetails({
					title: articles.collectionExists.title,
					url: articles.collectionExists.url
				}).then((data) => {
					assert.ok(!data.notAllowedToCreateCollection, "`notAllowedToCreateCollection` flag is not present.");
					assert.deepEqual(data, {
						collectionId: articles.collectionExists.collectionInfo.collectionSettings.collectionId,
						siteId: articles.collectionExists.sudsInfo.siteId
					}, "Collection details successfully returned.");

					setTimeout(() => {
						var collectionCache = mongodbMock.findInDb('collections', {
							_id: articles.collectionExists.id
						});

						assert.equal(collectionCache.length, 1, "Cache entry created.");
						assert.deepEqual(collectionCache[0], {
							_id: articles.collectionExists.id,
							collectionId: articles.collectionExists.collectionInfo.collectionSettings.collectionId,
							siteId: articles.collectionExists.sudsInfo.siteId
						}, "Collection details successfully cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return from the cache', function () {
			let collectionDataStore = new CollectionDataStore(articles.cached.id);

			return new Promise((resolve, reject) => {
				collectionDataStore.getCollectionDetails({
					title: articles.cached.title,
					url: articles.cached.url
				}).then((data) => {
					assert.deepEqual(data, {
						collectionId: articles.cached.cache.collectionId,
						siteId: articles.cached.cache.siteId
					}, "Collection details successfully returned.");

					setTimeout(() => {
						var collectionCache = mongodbMock.findInDb('collections', {
							_id: articles.cached.id
						});

						assert.equal(collectionCache.length, 1, "Cache entry is still in place.");
						assert.deepEqual(collectionCache[0], {
							_id: articles.cached.id,
							collectionId: articles.cached.cache.collectionId,
							siteId: articles.cached.cache.siteId
						}, "Collection details are still in cache.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});


		it('should be functioning correctly even if the connection to the DB is down', function () {
			let originalMongoUri = env.mongo.uri;
			env.mongo.uri = 'invalid';


			let collectionDataStore = new CollectionDataStore(articles.collectionExists2.id);

			return new Promise((resolve, reject) => {
				collectionDataStore.getCollectionDetails({
					title: articles.collectionExists2.title,
					url: articles.collectionExists2.url
				}).then((data) => {
					env.mongo.uri = originalMongoUri;


					assert.ok(!data.notAllowedToCreateCollection, "`notAllowedToCreateCollection` flag is not present.");
					assert.deepEqual(data, {
						collectionId: articles.collectionExists2.collectionInfo.collectionSettings.collectionId,
						siteId: articles.collectionExists2.sudsInfo.siteId
					}, "Collection details successfully returned.");

					setTimeout(() => {
						var collectionCache = mongodbMock.findInDb('collections', {
							_id: articles.collectionExists2.id
						});

						assert.equal(collectionCache.length, 0, "Cache entry not created.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});
	});
});

