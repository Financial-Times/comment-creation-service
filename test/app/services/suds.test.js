"use strict";

const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const NeedleMock = require('../../../mocks/needle');

consoleLogger.disable();

const env = {
	suds: {
		api: {
			getCollectionDetails: 'http://suds.ft.com/getCollectionDetails',
			getAuth: 'http://suds.ft.com/getAuth'
		}
	},
	'@global': true
};

const articles = {
	normal: {
		toSend: {
			articleId: '1026437b-6ddf-4c4f-8c5f-5961da3e1d6a',
			title: 'Normal article',
			url: 'http://ft.com/normal'
		},
		returnData: {
			siteId: 375234,
			articleId: '1026437b-6ddf-4c4f-8c5f-5961da3e1d6a',
			collectionMeta: '23d2f34f3f34f',
			checksum: '23rf43f45t45',
			collectionExists: true
		}
	},
	unclassified: {
		toSend: {
			articleId: 'a14da36e-08ec-4976-84e1-5e71e2fdf723',
			title: 'unclassified article',
			url: 'http://ft.com/unclassified'
		},
		returnData: {
			unclassifiedArticle: true
		}
	},
	notAllowedToCreate: {
		toSend: {
			articleId: '3377d67b-cc34-4698-a73e-32ef18c426d7',
			title: 'notAllowedToCreate article',
			url: 'http://ft.com/notAllowedToCreate'
		},
		returnData: {
			notAllowedToCreateCollection: true
		}
	},

	withRequiredParameters: {
		toSend: {
			articleId: '24b5cfa6-3774-49f5-a1a2-e7c1f17735c7',
			title: 'withRequiredParameters',
			url: 'http://ft.com/withRequiredParameters'
		},
		returnData: {}
	},
	withTags: {
		toSend: {
			articleId: 'bd986d2b-18da-405d-8b47-8f41342ffcbc',
			title: 'withTags',
			url: 'http://ft.com/withTags',
			tags: 'tag1,tag2'
		},
		returnData: {}
	},
	withSessionId: {
		toSend: {
			articleId: '50a689d0-e904-4dca-a05e-8ee22ca0ae23',
			title: 'withSessionId',
			url: 'http://ft.com/withSessionId',
			sessionId: '513432436fwfw'
		},
		returnData: {}
	},
	withStreamType: {
		toSend: {
			articleId: '96ded52f-ca81-45f5-af2a-984419dc364f',
			title: 'withStreamType',
			url: 'http://ft.com/withStreamType',
			streamType: 'livecomments'
		},
		returnData: {}
	}
};


const sessions = {
	valid: {
		id: '5234wdwfrfrff54f',
		getAuth: {
			token: '52wed43df34',
			displayName: 'testPseudonym'
		}
	}
};

const sudsCollectionDetailsArticle = {};
Object.keys(articles).forEach((key) => {
	sudsCollectionDetailsArticle[articles[key].toSend.articleId] = articles[key].returnData;
});

const sudsGetAuthSessions = {};
Object.keys(sessions).forEach((key) => {
	sudsGetAuthSessions[sessions[key].id] = sessions[key].getAuth;
});

const needleMock = new NeedleMock({
	items: [
		{
			url: env.suds.api.getCollectionDetails,
			handler: function (config) {
				if (config.matches.queryParams.articleId && config.matches.queryParams.articleId.indexOf('down') !== -1) {
					config.callback(new Error("Service down."));
					return;
				}

				if (!sudsCollectionDetailsArticle[config.matches.queryParams.articleId]) {
					config.callback(null, {
						statusCode: 404
					});
					return;
				}

				config.history[config.matches.queryParams.articleId] = config.matches;

				config.callback(null, {
					statusCode: 200,
					body: sudsCollectionDetailsArticle[config.matches.queryParams.articleId]
				});
			}
		},
		{
			url: env.suds.api.getAuth,
			handler: function (config) {
				if (config.matches.queryParams.sessionId && config.matches.queryParams.sessionId.indexOf('down') !== -1) {
					config.callback(new Error("Service down."));
					return;
				}

				if (sudsGetAuthSessions[config.matches.queryParams.sessionId]) {
					config.callback(null, {
						statusCode: 200,
						body: sudsGetAuthSessions[config.matches.queryParams.sessionId]
					});
					return;
				}

				config.callback(null, {
					statusCode: 401
				});
			}
		}
	],
	global: true
});

const suds = proxyquire('../../../app/services/suds.js', {
	'needle': needleMock.mock,
	'../../env': env
});

describe('suds', function() {
	describe('getCollectionDetails', function () {
		it('should return an error if no parameters are provided', function () {
			return suds.getCollectionDetails().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `articleId` is missing', function () {
			return suds.getCollectionDetails({
				title: 'Test title',
				url: 'Test url'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `title` is missing', function () {
			return suds.getCollectionDetails({
				articleId: 'test-article-id',
				url: 'Test url'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `url` is missing', function () {
			return suds.getCollectionDetails({
				articleId: 'test-article-id',
				title: 'Test title'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error with the relevant status code if the underlaying service is down', function () {
			return suds.getCollectionDetails({
				articleId: 'service-down',
				title: 'Test title',
				url: 'Test url'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "503 status code is returned.");
			});
		});

		it('should return an error with the relevant status code if the article is not found', function () {
			return suds.getCollectionDetails({
				articleId: 'not-found',
				title: 'Test title',
				url: 'Test url'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "404 status code is returned.");
			});
		});

		it('should return normal response if everything is fine', function () {
			return suds.getCollectionDetails(articles.normal.toSend).then((data) => {
				assert.deepEqual(data, articles.normal.returnData, "Expected data is returned.");
			});
		});

		it('should return unclassified article response if that is what SUDS returns', function () {
			return suds.getCollectionDetails(articles.unclassified.toSend).then((data) => {
				assert.deepEqual(data, articles.unclassified.returnData, "Expected data is returned.");
			});
		});

		it('should return `not allowed to creation collection` response if that is what SUDS returns', function () {
			return suds.getCollectionDetails(articles.notAllowedToCreate.toSend).then((data) => {
				assert.deepEqual(data, articles.notAllowedToCreate.returnData, "Expected data is returned.");
			});
		});


		it('should send all required parameters to the service', function () {
			return suds.getCollectionDetails(articles.withRequiredParameters.toSend).then(() => {
				assert.deepEqual(needleMock.getParamsHistoryForId(articles.withRequiredParameters.toSend.articleId).queryParams, articles.withRequiredParameters.toSend, "All required parameters are sent to the service.");
			});
		});

		it('should send `tags` parameter to the service', function () {
			return suds.getCollectionDetails(articles.withTags.toSend).then(() => {
				assert.deepEqual(needleMock.getParamsHistoryForId(articles.withTags.toSend.articleId).queryParams, articles.withTags.toSend, "`tags` parameter is sent to the service.");
			});
		});

		it('should send `sessionId` parameter to the service', function () {
			return suds.getCollectionDetails(articles.withSessionId.toSend).then(() => {
				assert.deepEqual(needleMock.getParamsHistoryForId(articles.withSessionId.toSend.articleId).queryParams, articles.withSessionId.toSend, "`sessionId` parameter is sent to the service.");
			});
		});

		it('should send `streamType` parameter to the service', function () {
			return suds.getCollectionDetails(articles.withStreamType.toSend).then(() => {
				assert.deepEqual(needleMock.getParamsHistoryForId(articles.withStreamType.toSend.articleId).queryParams.stream_type, articles.withStreamType.toSend.streamType, "`streamType` parameter is sent to the service as `stream_type`.");
			});
		});
	});

	describe('getAuth', function () {
		it('should return an error if no parameters are provided', function () {
			return suds.getAuth().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if the service is down', function () {
			return suds.getAuth('service-down').then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return an error if the session is not valid', function () {
			return suds.getAuth('invalid').then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 401, "Status code is correct.");
			});
		});

		it('should return the auth data if the session is valid', function () {
			return suds.getAuth(sessions.valid.id).then((data) => {
				assert.deepEqual(data, sessions.valid.getAuth, "Auth data successfully returned.");
			});
		});
	});
});
