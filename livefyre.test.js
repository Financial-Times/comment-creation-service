"use strict";

const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const MongodbMock = require('../../../mocks/mongodb');
const LivefyreMock = require('../../../mocks/livefyre');
const NeedleMock = require('../../../mocks/needle');
const _ = require('lodash');

consoleLogger.disable();


const articles = {
	normal: {
		id: 'a86755e4-46a5-11e1-bc5f-00144feabdc0',
		title: 'Test article',
		url: 'http://www.ft.com/cms/a86755e4-46a5-11e1-bc5f-00144feabdc0.html',
		siteId: 415343
	},
	siteIdNotSetUp: {
		id: '3f330864-1c0f-443e-a6b3-cf8a3b536a52',
		title: 'Test article 2',
		url: 'http://www.ft.com/cms/3f330864-1c0f-443e-a6b3-cf8a3b536a52.html',
		siteId: 252346
	},
	noCollection: {
		id: 'e78d07ca-680f-11e5-a57f-21b88f7d973f',
		title: 'Test article 3',
		url: 'http://www.ft.com/cms/e78d07ca-680f-11e5-a57f-21b88f7d973f.html',
		siteId: 523435
	},
	unclassified: {
		id: '24b7158f-a017-43d2-a288-6d3aead3ad27',
		title: 'Test article 3',
		url: 'http://www.ft.com/cms/e78d07ca-680f-11e5-a57f-21b88f7d973f.html',
		siteId: 'unclassified'
	}
};

let articleCollectionExists = [articles.normal.id, articles.normal.siteIdNotSetUp];


let legacySiteMapping = [];
Object.keys(articles).forEach(function (key, index) {
	legacySiteMapping.push({
		_id: articles[key].id,
		siteId: articles[key].siteId
	});
});





const userId = '3f330864-1c0f-443e-a6b3-cf8a3b536a52';
const displayName = 'testName';


const validToken = 'tafg342fefwef';

const systemToken = 'system-token';

const env = {
	livefyre: {
		network: {
			name: 'ft-1',
			key: 'network-key'
		},
		defaultSiteId: 1412,
		siteKeys: {
			1: 'key1',
			2: 'key2',
			3: 'key3',
			415343: 'key415343',
			1412: 'key1412'
		},
		api: {
			collectionExistsUrl: 'http://{networkName}.collection-exists.livefyre.com/{articleIdBase64}',
			pingToPullUrl: 'http://{networkName}.ping-to-pull.livefyre.com/{userId}?token={token}',
			bootstrapUrl: 'http://bootstrap.{networkName}.fyre.co/bs3/{networkName}.fyre.co/{siteId}/{articleIdBase64}/bootstrap.html'
		}
	},
	mongo: {
		uri: 'mongo-uri-livefyre'
	},
	'@global': true
};


const needleMock = new NeedleMock({
	env: env,
	articlesCollectionExists: articleCollectionExists,
	systemToken: systemToken,
	userIdsPingToPull: [userId],
	global: true
});

const mongodbMock = new MongodbMock({
	dbMock: {
		legacy_site_mapping: legacySiteMapping
	},
	global: true
});
const livefyreMock = new LivefyreMock({
	systemToken: systemToken,
	validToken: validToken,
	global: true
});

const livefyreService = proxyquire('../../../app/services/livefyre.js', {
	'livefyre': livefyreMock.mock,
	'../../env': env,
	'needle': needleMock.mock,
	'mongodb': mongodbMock.mock
});

describe('livefyreService', function() {
	describe('getCollectionDetails', function () {
		it('should return error if the UUID is unclassified', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.unclassified.id,
				title: articles.unclassified.title,
				url: articles.unclassified.url
			}, function (err, data) {
				assert.deepEqual(err, {
					unclassified: true
				}, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return error if legacySiteMapping returns error', function (done) {
			var mongoUri = env.mongo.uri;
			env.mongo.uri = 'invalid';

			livefyreService.getCollectionDetails({
				articleId: articles.normal.id,
				title: articles.normal.title,
				url: articles.normal.url
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				env.mongo.uri = mongoUri;
				done();
			});
		});

		it('should return error if site key is not set', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.siteIdNotSetUp.id,
				title: articles.siteIdNotSetUp.title,
				url: articles.siteIdNotSetUp.url
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return error if articleId is omitted', function (done) {
			livefyreService.getCollectionDetails({
				title: articles.normal.title,
				url: articles.normal.url
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return error if title is omitted', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.normal.id,
				url: articles.normal.url
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return error if url is omitted', function (done) {
			livefyreService.getCollectionDetails({
				title: articles.normal.title,
				articleId: articles.normal.id
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return collection details without errors', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.normal.id,
				title: articles.normal.title,
				url: articles.normal.url
			}, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.deepEqual(data, {
					siteId: articles.normal.siteId,
					articleId: articles.normal.id,
					collectionMeta: {
						collectionMeta: {
							tags: '',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'livecomments',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					},
					checksum: {
						checksum: {
							tags: '',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'livecomments',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					}
				}, "Collection details is correctly returned.");

				done();
			});
		});

		it('should return collection details with the tags provided (and escaped properly)', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.normal.id,
				title: articles.normal.title,
				url: articles.normal.url,
				tags: ['tag1', 'tag2', 'tag 3']
			}, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.deepEqual(data, {
					siteId: articles.normal.siteId,
					articleId: articles.normal.id,
					collectionMeta: {
						collectionMeta: {
							tags: 'tag1,tag2,tag_3',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'livecomments',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					},
					checksum: {
						checksum: {
							tags: 'tag1,tag2,tag_3',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'livecomments',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					}
				}, "Collection details is correctly returned.");

				done();
			});
		});

		it('should return collection details with the provided stream_type', function (done) {
			livefyreService.getCollectionDetails({
				articleId: articles.normal.id,
				title: articles.normal.title,
				url: articles.normal.url,
				stream_type: 'liveblogs'
			}, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.deepEqual(data, {
					siteId: articles.normal.siteId,
					articleId: articles.normal.id,
					collectionMeta: {
						collectionMeta: {
							tags: '',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'liveblogs',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					},
					checksum: {
						checksum: {
							tags: '',
							networkName: env.livefyre.network.name + '.fyre.co',
							networkKey: env.livefyre.network.key,
							siteId: articles.normal.siteId,
							siteKey: env.livefyre.siteKeys[articles.normal.siteId],
							streamType: 'liveblogs',
							title: articles.normal.title,
							articleId: articles.normal.id,
							url: articles.normal.url
						}
					}
				}, "Collection details is correctly returned.");

				done();
			});
		});
	});

	describe('getBootstrapUrl', function () {
		it('should return error if legacySiteMapping returns error', function (done) {
			var mongoUri = env.mongo.uri;
			env.mongo.uri = 'invalid';

			livefyreService.getBootstrapUrl('invalid-uuid', function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				env.mongo.uri = mongoUri;
				done();
			});
		});

		it('should return the URL', function (done) {
			livefyreService.getBootstrapUrl(articles.normal.id, function (err, data) {
				assert.ok(!err, "Error is not returned.");

				var url = env.livefyre.api.bootstrapUrl;
				url = url.replace(/\{networkName\}/g, env.livefyre.network.name);
				url = url.replace(/\{articleIdBase64\}/g, new Buffer(articles.normal.id).toString('base64'));
				url = url.replace(/\{siteId\}/g, articles.normal.siteId);

				assert.equal(data, url, "Bootstrap URL has the correct format and parameters.");

				done();
			});
		});
	});

	describe('collectionExists', function () {
		it('should return error if legacySiteMapping returns error', function (done) {
			var mongoUri = env.mongo.uri;
			env.mongo.uri = 'invalid';

			livefyreService.collectionExists('invalid-uuid', function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				env.mongo.uri = mongoUri;
				done();
			});
		});

		it('should return false if the collection does not exist', function (done) {
			livefyreService.collectionExists(articles.noCollection.id, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.equal(data, false, "Collection does not exist.");

				done();
			});
		});

		it('should return true if the collection exists', function (done) {
			livefyreService.collectionExists(articles.normal.id, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.equal(data, true, "Collection exists.");

				done();
			});
		});
	});

	describe('generateAuthToken', function () {
		it('should return error if userId is omitted', function (done) {
			livefyreService.generateAuthToken({
				displayName: displayName
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return error if displayName is omitted', function (done) {
			livefyreService.generateAuthToken({
				userId: userId
			}, function (err, data) {
				assert.ok(err, "Error is returned.");
				assert.ok(data === undefined || data === null, "Data is not set.");

				done();
			});
		});

		it('should return token', function (done) {
			livefyreService.generateAuthToken({
				userId: userId,
				displayName: displayName
			}, function (err, data) {
				assert.ok(!err, "Error is not returned.");
				assert.deepEqual(Object.keys(data), ['token', 'expires'], "Response has the expected fields.");
				assert.deepEqual(Object.keys(data.token), ['userId', 'displayName', 'expires'], "Token has the expected fields.");
				assert.deepEqual(_.pick(data.token, ['userId', 'displayName']), {
					userId: userId,
					displayName: displayName
				}, "Token has the expected data.");

				done();
			});
		});

		it('should return token with default expiry time', function (done) {
			livefyreService.generateAuthToken({
				userId: userId,
				displayName: displayName
			}, function (err, data) {
				assert.ok(Math.abs(new Date(new Date().getTime() + data.token.expires * 1000).getTime() - new Date(data.expires).getTime()) < 10, "Expires field and the expiration field in token point to the same date.");

				done();
			});
		});

		it('should return token with `expires` specified', function (done) {
			var start = new Date();
			var expiresIn = 60;
			livefyreService.generateAuthToken({
				userId: userId,
				displayName: displayName,
				expires: expiresIn
			}, function (err, data) {
				var end = new Date();

				assert.ok(data.token.expires >= expiresIn - 1 && data.token.expires <= expiresIn + 1, "Expires value in the token states an expiration in approximately 24 hours.");
				assert.ok(data.expires >= new Date(start.getTime() + expiresIn * 1000).getTime() && data.expires <= new Date(end.getTime() + expiresIn * 1000).getTime(), "Expires value states an expiration data approximately in the specified time.");

				done();
			});
		});

		it('should return token with `expireAt` specified', function (done) {
			var start = new Date();
			var expiresIn = 60;
			var expiresAt = new Date(start.getTime() + expiresIn * 1000);
			livefyreService.generateAuthToken({
				userId: userId,
				displayName: displayName,
				expiresAt: expiresAt
			}, function (err, data) {
				assert.ok(data.token.expires >= expiresIn - 1 && data.token.expires <= expiresIn + 1, "Expires value in the token states an expiration in approximately 24 hours.");
				assert.ok(Math.abs(data.expires - expiresAt.getTime()) < 10, "Expires value states an expiration data in the specified time.");

				done();
			});
		});
	});

	describe('validateToken', function () {
		it('should return false if the token is not valid', function () {
			var validation = livefyreService.validateToken('invalid-token');
			assert.equal(validation, false, "The token is not valid.");
		});

		it('should return false if the token is not valid', function () {
			var validation = livefyreService.validateToken(validToken);
			assert.equal(validation, true, "The token is valid.");
		});
	});

	describe('callPingToPull', function () {
		it('should return error if invalid user ID is specified', function (done) {
			livefyreService.callPingToPull('invalid-uuid', function (err) {
				assert.ok(err, "Error returned.");

				done();
			});
		});

		it('should call the service with no issues if valid user ID is specified', function (done) {
			livefyreService.callPingToPull(userId, function (err) {
				assert.ok(!err, "Error not returned.");

				done();
			});
		});
	});
});
