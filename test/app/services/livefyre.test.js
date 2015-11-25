"use strict";

const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const NeedleMock = require('../../../mocks/needle');

consoleLogger.disable();

const env = {
	livefyre: {
		network: {
			name: 'ft123'
		},
		api: {
			commentsByPageUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/commentsByPageUrl/{pageNumber}.json',
			collectionInfoPlusUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/collectionInfoPlusUrl',
			createCollectionUrl: 'http://{networkName}.fyre.co/{siteId}/commentsByPageUrl',
			unfollowCollectionUrl: 'http://{networkName}.fyre.co/collection/{collectionId}/unfollow/',
			postCommentUrl: 'http://{networkName}.fyre.co/collection/{collectionId}/post/',
			deleteCommentUrl: 'http://{networkName}.fyre.co/comment/{commentId}/delete/'
		}
	},
	'@global': true
};

const articles = {
	normal: {
		id: 'f243f394-a67f-4331-920d-aeb829b5189b',
		siteId: 513432,
		collectionInfo: {
			headDocument: {},
			collectionSettings: {}
		},
		comments: {
			0: {
				content: [{
					id: 'comment1',
					authorId: 'author1'
				}],
				authors: [{
					id: 'author1'
				}]
			},
			1: {
				content: [{
					id: 'comment2',
					authorId: 'author2'
				}],
				authors: [{
					id: 'author2'
				}]
			}
		}
	}
};

const collectionInfoPlusArticles = {};
Object.keys(articles).forEach((key) => {
	collectionInfoPlusArticles[articles[key].id] = articles[key];
});

const commentsByPageArticles = {};
Object.keys(articles).forEach((key) => {
	commentsByPageArticles[articles[key].id] = articles[key];
});

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

				config.callback(null, {
					statusCode: 200,
					body: {
						"status": "ok"
					}
				});
			}
		},
		{
			url: env.livefyre.api.commentsByPageUrl,
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

				let article = commentsByPageArticles[articleId];
				if (article && String(article.siteId) === String(config.matches.urlParams.siteId)) {
					config.callback(null, {
						statusCode: 200,
						body: article.comments[config.matches.urlParams.pageNumber]
					});
					return;
				}

				config.callback(null, {
					statusCode: 404
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

				let article = collectionInfoPlusArticles[articleId];
				if (article && String(article.siteId) === String(config.matches.urlParams.siteId)) {
					config.callback(null, {
						statusCode: 200,
						body: article.collectionInfo
					});
					return;
				}

				config.callback(null, {
					statusCode: 404
				});
			}
		},
		{
			url: env.livefyre.api.unfollowCollectionUrl,
			handler: function (config) {
				if (config.matches.urlParams.networkName !== env.livefyre.network.name) {
					config.callback(new Error("Network is not correct."));
					return;
				}

				if (config.matches.urlParams.collectionId && config.matches.urlParams.collectionId.indexOf('down') !== -1) {
					config.callback(new Error("Service down"));
					return;
				}

				if (config.matches.urlParams.collectionId && config.matches.urlParams.collectionId.indexOf('notfound') !== -1) {
					config.callback(null, {
						statusCode: 404
					});
					return;
				}

				config.history[config.matches.urlParams.collectionId] = config;
				config.callback(null, {
					statusCode: 200,
					body: {
						status: "ok",
						code: 200
					}
				});
			}
		},
		{
			url: env.livefyre.api.postCommentUrl,
			handler: function (config) {
				if (config.matches.urlParams.networkName !== env.livefyre.network.name) {
					config.callback(new Error("Network is not correct."));
					return;
				}

				if (config.matches.urlParams.collectionId && config.matches.urlParams.collectionId.indexOf('down') !== -1) {
					config.callback(new Error("Service down"));
					return;
				}

				if (config.matches.urlParams.collectionId && config.matches.urlParams.collectionId.indexOf('notfound') !== -1) {
					config.callback(null, {
						statusCode: 404,
						body: {
							status: "error",
							code: 404
						}
					});
					return;
				}

				config.history[config.matches.urlParams.collectionId] = config;
				config.callback(null, {
					statusCode: 200,
					body: {
						status: "ok",
						code: 200,
						data: {
							messages: [{
								collectionId: config.matches.urlParams.collectionId,
								content: {
									bodyHtml: config.postData.body
								}
							}],
							authors: []
						}
					}
				});
			}
		},
		{
			url: env.livefyre.api.deleteCommentUrl,
			handler: function (config) {
				if (config.matches.urlParams.networkName !== env.livefyre.network.name) {
					config.callback(new Error("Network is not correct."));
					return;
				}

				if (config.matches.urlParams.commentId && config.matches.urlParams.commentId.indexOf('down') !== -1) {
					config.callback(new Error("Service down"));
					return;
				}

				if (config.matches.urlParams.commentId && config.matches.urlParams.commentId.indexOf('notfound') !== -1) {
					config.callback(null, {
						statusCode: 404,
						body: {
							status: "error",
							code: 404
						}
					});
					return;
				}

				config.history[config.matches.urlParams.commentId] = config;
				config.callback(null, {
					statusCode: 200,
					body: {
						status: "ok",
						code: 200
					}
				});
			}
		}
	],
	global: true
});

const livefyre = proxyquire('../../../app/services/livefyre.js', {
	'needle': needleMock.mock,
	'../../env': env
});

describe('livefyre', function() {
	describe('createCollection', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.createCollection().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `collectionMeta` parameter is missing', function () {
			return livefyre.createCollection({
				siteId: 513423
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `siteId` parameter is missing', function () {
			return livefyre.createCollection({
				collectionMeta: 't6235fr43f34f4f'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return error if the service is down', function () {
			return livefyre.createCollection({
				collectionMeta: 'service-down',
				siteId: 325234
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if the response is `not found`', function () {
			return livefyre.createCollection({
				collectionMeta: 'notfound',
				siteId: 325234
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return success if the parameters are correct', function () {
			let collectionMeta = 't6235fr43f34f4f';
			let siteId = 432523;

			return livefyre.createCollection({
				collectionMeta: collectionMeta,
				siteId: siteId
			}).then(() => {
				assert.ok(true, "Success.");
				assert.deepEqual(needleMock.getParamsHistoryForId(collectionMeta).postData, {
					collectionMeta: collectionMeta
				}, "The post data sent to the service is correct.");

				assert.deepEqual(needleMock.getParamsHistoryForId(collectionMeta).siteId, siteId, "The data sent by URL parameters to the service is correct.");
			});
		});

		it('should send `checksum` parameter if available', function () {
			let collectionMeta = 't6235fr43f34f4f2';
			let siteId = 432524;
			let checksum = 'f2f34rf4f';

			return livefyre.createCollection({
				collectionMeta: collectionMeta,
				siteId: siteId,
				checksum: checksum
			}).then(() => {
				assert.ok(true, "Success.");
				assert.deepEqual(needleMock.getParamsHistoryForId(collectionMeta).postData, {
					collectionMeta: collectionMeta,
					checksum: checksum
				}, "The post data sent to the service is correct.");
			});
		});
	});

	describe('getCollectionInfoPlus', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.getCollectionInfoPlus().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `articleId` parameter is missing', function () {
			return livefyre.getCollectionInfoPlus({
				siteId: 513423
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `siteId` parameter is missing', function () {
			return livefyre.getCollectionInfoPlus({
				articleId: 't6235fr43f34f4f'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if the service is down', function () {
			return livefyre.getCollectionInfoPlus({
				articleId: 'service-down',
				siteId: 5234324
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return an error if the the article is not found', function () {
			return livefyre.getCollectionInfoPlus({
				articleId: 'notfound',
				siteId: 5234324
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return success and the data received from the services if the parameters are correct', function () {
			return livefyre.getCollectionInfoPlus({
				articleId: articles.normal.id,
				siteId: articles.normal.siteId
			}).then((data) => {
				assert.deepEqual(data, articles.normal.collectionInfo, "Data received correctly.");
			});
		});
	});

	describe('getCommentsByPage', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `articleId` parameter is missing', function () {
			return livefyre.getCommentsByPage({
				siteId: 513423,
				pageNumber: 0
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `siteId` parameter is missing', function () {
			return livefyre.getCommentsByPage({
				articleId: 't6235fr43f34f4f',
				pageNumber: 0
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `pageNumber` parameter is missing', function () {
			return livefyre.getCommentsByPage({
				articleId: 't6235fr43f34f4f',
				siteId: 513423
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return error if the service is down', function () {
			return livefyre.getCommentsByPage({
				articleId: 'service-down',
				siteId: 513423,
				pageNumber: 0
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if the article is not found', function () {
			return livefyre.getCommentsByPage({
				articleId: 'notfound',
				siteId: 513423,
				pageNumber: 0
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return the article with the page requested', function () {
			return livefyre.getCommentsByPage({
				articleId: articles.normal.id,
				siteId: articles.normal.siteId,
				pageNumber: 0
			}).then((data) => {
				assert.deepEqual(data, articles.normal.comments[0]);
			});
		});

		it('should return the article with the page requested', function () {
			return livefyre.getCommentsByPage({
				articleId: articles.normal.id,
				siteId: articles.normal.siteId,
				pageNumber: 1
			}).then((data) => {
				assert.deepEqual(data, articles.normal.comments[1]);
			});
		});
	});

	describe('unfollowCollection', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.unfollowCollection().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `collectionId` parameter is missing', function () {
			return livefyre.unfollowCollection({
				token: 513423
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `token` parameter is missing', function () {
			return livefyre.unfollowCollection({
				collectionId: 6245333
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if the service is down', function () {
			return livefyre.unfollowCollection({
				collectionId: 'service-down',
				token: 'sfgr3f543f'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return an error if the the collection is not found', function () {
			return livefyre.unfollowCollection({
				collectionId: 'notfound',
				token: 'sfgr3f543f'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return success and the data received from the services if the parameters are correct', function () {
			return livefyre.unfollowCollection({
				collectionId: 345353,
				token: 'sfgr3f543f'
			}).then((data) => {
				assert.deepEqual(data, {
					status: "ok",
					code: 200
				}, "Data received correctly.");
			});
		});

		it('should send the user token as a post data', function () {
			let collectionId = 54234343;
			let token = 'sgsdfdfg34r344';

			return livefyre.unfollowCollection({
				collectionId: collectionId,
				token: token
			}).then((data) => {
				assert.deepEqual(needleMock.getParamsHistoryForId(collectionId).postData, {
					lftoken: token
				}, "Token sent correctly as post data.");
			});
		});
	});

	describe('postComment', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.postComment().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `collectionId` parameter is missing', function () {
			return livefyre.postComment({
				token: '52343dwdwfwe',
				commentBody: 'asd'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `token` parameter is missing', function () {
			return livefyre.postComment({
				collectionId: 6245333,
				commentBody: 'asd'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `commentBody` parameter is missing', function () {
			return livefyre.postComment({
				collectionId: 6245333,
				token: '52343dwdwfwe'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if the service is down', function () {
			return livefyre.postComment({
				collectionId: 'service-down',
				token: '52343dwdwfwe',
				commentBody: 'asd'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return an error if the collection is not found', function () {
			return livefyre.postComment({
				collectionId: 'notfound',
				token: '52343dwdwfwe',
				commentBody: 'asd'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return success message if all parameters are correct', function () {
			let collectionId = "524234";
			let token = 'gsfsfwrf43f34';
			let commentBody = 'test comment body';

			return livefyre.postComment({
				collectionId: collectionId,
				token: token,
				commentBody: commentBody
			}).then((data) => {
				assert.deepEqual(data, {
					status: "ok",
					code: 200,
					data: {
						messages: [{
							collectionId: collectionId,
							content: {
								bodyHtml: commentBody
							}
						}],
						authors: []
					}
				});
			});
		});

		it('should send the post data correctly', function () {
			let collectionId = "524234234";
			let token = 'gsfsfwrf43f34234';
			let commentBody = 'test comment body 2';

			return livefyre.postComment({
				collectionId: collectionId,
				token: token,
				commentBody: commentBody
			}).then((data) => {
				assert.deepEqual(needleMock.getParamsHistoryForId(collectionId).postData, {
					lftoken: token,
					body: commentBody
				});
			});
		});
	});

	describe('deleteComment', function () {
		it('should return an error if no parameters are provided', function () {
			return livefyre.deleteComment().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `collectionId` parameter is missing', function () {
			return livefyre.deleteComment({
				token: '52343dwdwfwe',
				commentId: 514234
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `token` parameter is missing', function () {
			return livefyre.deleteComment({
				collectionId: 6245333,
				commentId: 514234
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if `commentId` parameter is missing', function () {
			return livefyre.deleteComment({
				collectionId: 6245333,
				token: '52343dwdwfwe'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return an error if the service is down', function () {
			return livefyre.deleteComment({
				collectionId: '3242342',
				token: '52343dwdwfwe',
				commentId: 'service-down'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return an error if the collection is not found', function () {
			return livefyre.deleteComment({
				collectionId: '4234233',
				token: '52343dwdwfwe',
				commentId: 'notfound'
			}).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return success message if all parameters are correct', function () {
			let collectionId = "5242252334";
			let token = 'gsfsfwrf4345323f34';
			let commentId = '34534334';

			return livefyre.deleteComment({
				collectionId: collectionId,
				token: token,
				commentId: commentId
			}).then((data) => {
				assert.deepEqual(data, {
					status: "ok",
					code: 200
				});
			});
		});

		it('should send the post data correctly', function () {
			let collectionId = "334433454";
			let token = '422f34f34f54f4';
			let commentId = '53434534';

			return livefyre.deleteComment({
				collectionId: collectionId,
				token: token,
				commentId: commentId
			}).then((data) => {
				assert.deepEqual(needleMock.getParamsHistoryForId(commentId).postData, {
					lftoken: token,
					collection_id: collectionId
				});
			});
		});
	});
});
