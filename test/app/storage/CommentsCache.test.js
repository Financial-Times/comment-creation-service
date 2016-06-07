"use strict";

const _ = require('lodash');
const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const RequestMock = require('../../../mocks/request');
const MongodbMock = require('../../../mocks/mongodb');
const uuid = require('node-uuid');
const LivefyreMock = require('../../../mocks/livefyre');

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
			commentsByPageUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/commentsByPageUrl/{pageNumber}.json',
			collectionInfoPlusUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/collectionInfoPlusUrl'
		}
	},
	cache: {
		commentsExpireInMinutes: 5
	},
	'@global': true
};


function generateLfComment (number, authorId, vis) {
	return {
		content: {
			id: 'comment' + number,
			parentId: null,
			authorId: authorId,
			bodyHtml: 'Comment ' + number,
			createdAt: new Date().getTime()
		},
		event: number,
		vis: vis
	};
}

function generateLfUser (number) {
	return {
		id: 'author' + number,
		displayName: 'User' + number,
		tags: [
			'FT'
		],
		type: 1
	};
}

function transformLfComment (lfComment, lfAuthor) {
	return {
		parentId: lfComment.content.parentId,
		content: lfComment.content.bodyHtml,
		timestamp: lfComment.content.createdAt,
		commentId: lfComment.content.id,
		visibility: lfComment.vis,
		author: {
			id: lfAuthor.id,
			displayName: lfAuthor.displayName,
			tags: lfAuthor.tags,
			type: lfAuthor.type
		}
	};
}


const articles = {
	totalPagesCached: {
		id: 'f9bd98f1-ed0b-4e2d-98f5-d068d11649fd',
		siteId: 5324534,
		cached: {
			totalPages: 3
		},
		comments: {
			0: {
				content: [
					generateLfComment(1, 'author1', 1),
					generateLfComment(2, 'author2', 1),
					generateLfComment(3, 'author1', 2)
				],
				authors: {
					author1: generateLfUser(1),
					author2: generateLfUser(2)
				}
			},
			1: {
				content: [
					generateLfComment(4, 'author1', 1),
					generateLfComment(5, 'author1', 2)
				],
				authors: {
					author1: generateLfUser(1),
					author2: generateLfUser(2)
				}
			},
			2: {
				content: [
					generateLfComment(6, 'author1', 1),
					generateLfComment(7, 'author1', 1)
				],
				authors: {
					author1: generateLfUser(1),
					author2: generateLfUser(2)
				}
			}
		}
	},
	commentsCached: {
		id: 'aef135bd-cd29-4d59-92a3-e13d5a09a39b',
		siteId: 5242342,
		cached: {
			totalPages: 2,
			comments: {
				page0: {
					comments: [
						transformLfComment(generateLfComment(7, 'author1', 1), generateLfUser(1)),
						transformLfComment(generateLfComment(5, 'author2', 1), generateLfUser(2)),
						transformLfComment(generateLfComment(4, 'author1', 1), generateLfUser(1))
					],
					totalPages: 2,
					nextPage: null,
					lastEvent: 7
				},
				page1: {
					comments: [
						transformLfComment(generateLfComment(3, 'author1', 1), generateLfUser(1)),
						transformLfComment(generateLfComment(1, 'author2', 1), generateLfUser(2))
					],
					totalPages: 2,
					nextPage: 0,
					lastEvent: 3
				}
			}
		}
	}
};

const byArticleId = {};
Object.keys(articles).forEach((key) => {
	byArticleId[articles[key].id] = articles[key];
});


function generateArticle (noOfPages) {
	let id = uuid.v4();
	let siteId = parseInt(Math.random() * 899999 + 100000, 10);

	let articleData = {
		id: id,
		siteId: siteId,
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				archiveInfo: {
					nPages: noOfPages
				}
			}
		}
	};

	const author1 = generateLfUser(1);
	const author2 = generateLfUser(2);

	if (noOfPages > 0) {
		articleData.comments = {};

		let commentIdIndex = 1;
		for (let i = 0; i < noOfPages; i++) {
			if (!articleData.comments[i]) {
				articleData.comments[i] = {
					content: [],
					authors: {
						author1: author1,
						author2: author2
					}
				};
			}

			for (let j = 0; j < 4; j++) {
				articleData.comments[i].content.push(generateLfComment(commentIdIndex, 'author' + (j % 2 + 1), j % 2 + 1));
				commentIdIndex++;
			}
		}
	}

	byArticleId[id] = articleData;

	return articleData;
}


function transformLfPage (article, page) {
	let comments = article.comments[page].content;
	let authors = article.comments[page].authors;

	let processedComments = [];
	let maxEvent = 0;

	comments.forEach((comment) => {
		if (comment.vis === 1) {
			processedComments.unshift(transformLfComment(comment, authors[comment.content.authorId]));
		}

		if (comment.event > maxEvent) {
			maxEvent = comment.event;
		}
	});

	return {
		comments: processedComments,
		lastEvent: maxEvent
	};
}


const requestMock = new RequestMock({
	items: [
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

				let article = byArticleId[articleId];
				if (article && article.comments && String(article.siteId) === String(config.matches.urlParams.siteId)) {
					config.callback(null, {
						statusCode: 200,
						body: JSON.stringify(article.comments[config.matches.urlParams.pageNumber])
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

				let article = byArticleId[articleId];
				if (article && article.collectionInfo && String(article.siteId) === String(config.matches.urlParams.siteId)) {
					config.callback(null, {
						statusCode: 200,
						body: JSON.stringify(article.collectionInfo)
					});
					return;
				}

				config.callback(null, {
					statusCode: 404
				});
			}
		}
	],
	global: true
});

const systemToken = 'system-token';
const livefyreMock = new LivefyreMock({
	systemToken: systemToken,
	global: true
});


const commentsCache = [];
Object.keys(articles).forEach((key) => {
	if (articles[key].cached) {
		commentsCache.push(_.extend({_id: articles[key].id + '-' + articles[key].siteId}, articles[key].cached));
	}
});


const mongodbMock = new MongodbMock({
	dbMock: {
		comments: commentsCache
	},
	global: true
});


const CommentsCache = proxyquire('../../../app/storage/CommentsCache.js', {
	'request': requestMock.mock,
	'../../env': env,
	mongodb: mongodbMock.mock,
	livefyre: livefyreMock.mock
});

describe('CommentsCache', function () {
	describe('getCommentsByPage', function () {
		it('should return error if `articleId` is not provided', function () {
			let commentsCache = new CommentsCache();

			return commentsCache.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if `siteId` is not provided', function () {
			let commentsCache = new CommentsCache('articleId');

			return commentsCache.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if a service is down', function () {
			let commentsCache = new CommentsCache('service-down', 'siteId');

			return commentsCache.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if the article/collection is not found', function () {
			let commentsCache = new CommentsCache('not found', 'siteId');

			return commentsCache.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});


		it('should return empty array and cache only the total page number', function () {
			let startTime = new Date();

			let article = generateArticle(0);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage().then((data) => {
					let endTime = new Date();

					assert.deepEqual(data, {
						comments: [],
						lastEvent: 0,
						totalPages: 0,
						nextPage: null
					}, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: article.id + '-' + article.siteId,
							totalPages: 0
						}, "Comments total pages correctly cached.");

						assert.ok(commentsCacheEntry[0].expireAt >= new Date(startTime.getTime() + env.cache.commentsExpireInMinutes * 60 * 1000) &&
							commentsCacheEntry[0].expireAt <= new Date(endTime.getTime() + env.cache.commentsExpireInMinutes * 60 * 1000), "Expires in " + env.cache.commentsExpireInMinutes + " minutes.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return empty array and cache only the total page number if there are no pages and pageNumber is 0', function () {
			let startTime = new Date();

			let article = generateArticle(0);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(0).then((data) => {
					let endTime = new Date();

					assert.deepEqual(data, {
						comments: [],
						lastEvent: 0,
						totalPages: 0,
						nextPage: null
					}, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: article.id + '-' + article.siteId,
							totalPages: 0
						}, "Comments total pages correctly cached.");

						assert.ok(commentsCacheEntry[0].expireAt >= new Date(startTime.getTime() + env.cache.commentsExpireInMinutes * 60 * 1000) &&
							commentsCacheEntry[0].expireAt <= new Date(endTime.getTime() + env.cache.commentsExpireInMinutes * 60 * 1000), "Expires in " + env.cache.commentsExpireInMinutes + " minutes.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if the page does not exist', function () {
			let article = generateArticle(0);
			let commentsCache = new CommentsCache(article.id, article.siteId);

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});


		it('should return the comments for init (processed and ordered by recent first)', function () {
			let article = generateArticle(1);

			let commentsCache = new CommentsCache(article.id, article.siteId);


			let expectedComments = _.extend({
				totalPages: 1,
				nextPage: null
			}, transformLfPage(article, 0));


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage().then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: article.id + '-' + article.siteId,
							totalPages: 1,
							comments: {
								page0: expectedComments
							}
						}, "Comments total pages correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if the page does not exist', function () {
			let article = generateArticle(1);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});



		it('should combine the last 2 pages if there are 2 pages in total for init', function () {
			let article = generateArticle(2);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			let commentsPage1 = transformLfPage(article, 1);
			let commentsPage0 = transformLfPage(article, 0);

			let expectedComments = {
				totalPages: 2,
				nextPage: null,
				comments: [].concat(commentsPage1.comments).concat(commentsPage0.comments),
				lastEvent: commentsPage1.lastEvent
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage().then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: article.id + '-' + article.siteId,
							totalPages: 2,
							comments: {
								page1: _.extend({
									totalPages: 2,
									nextPage: 0
								}, commentsPage1),
								page0: _.extend({
									totalPages: 2,
									nextPage: null
								}, commentsPage0)

							}
						}, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return a single page correctly', function () {
			let article = generateArticle(2);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			let expectedComments = _.extend({
				totalPages: 2,
				nextPage: 0
			}, transformLfPage(article, 1));


			return commentsCache.getCommentsByPage(1).then((data) => {
				assert.deepEqual(data, expectedComments, "Comments returned correctly.");
			});
		});

		it('should return 404 if the page does not exist', function () {
			let article = generateArticle(2);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			return commentsCache.getCommentsByPage(2).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});



		it('should combine the last 2 pages if there are 3 pages for init', function () {
			let article = generateArticle(3);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			let commentsPage2 = transformLfPage(article, 2);
			let commentsPage1 = transformLfPage(article, 1);

			let expectedComments = {
				totalPages: 3,
				nextPage: 0,
				comments: [].concat(commentsPage2.comments).concat(commentsPage1.comments),
				lastEvent: commentsPage2.lastEvent
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage().then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: article.id + '-' + article.siteId,
							totalPages: 3,
							comments: {
								page2: _.extend({
									totalPages: 3,
									nextPage: 1
								}, commentsPage2),
								page1: _.extend({
									totalPages: 3,
									nextPage: 0
								}, commentsPage1)
							}
						}, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return the next page', function () {
			let article = generateArticle(3);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			let commentsPage0 = transformLfPage(article, 0);

			let expectedComments = {
				totalPages: 3,
				nextPage: null,
				comments: commentsPage0.comments,
				lastEvent: commentsPage0.lastEvent
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(0).then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(commentsCacheEntry[0].comments.page0, expectedComments, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if the page does not exist', function () {
			let article = generateArticle(3);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			return commentsCache.getCommentsByPage(3).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});


		// total pages cached
		it('should load total pages from cache if it exists', function () {
			let commentsCache = new CommentsCache(articles.totalPagesCached.id, articles.totalPagesCached.siteId);

			let commentsPage2 = transformLfPage(articles.totalPagesCached, 2);
			let commentsPage1 = transformLfPage(articles.totalPagesCached, 1);

			let expectedComments = {
				totalPages: 3,
				nextPage: 0,
				comments: [].concat(commentsPage2.comments).concat(commentsPage1.comments),
				lastEvent: commentsPage2.lastEvent
			};

			return commentsCache.getCommentsByPage().then((data) => {
				assert.deepEqual(data, expectedComments, "Comments returned correctly.");
			});
		});

		it('should return 404 if the page does not exist', function () {
			let commentsCache = new CommentsCache(articles.totalPagesCached.id, articles.totalPagesCached.siteId);

			return commentsCache.getCommentsByPage(3).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});


		// cached all
		it('should load cached comments if exists for init', function () {
			let commentsCache = new CommentsCache(articles.commentsCached.id, articles.commentsCached.siteId);

			return commentsCache.getCommentsByPage().then((data) => {
				assert.deepEqual(data, {
					totalPages: articles.commentsCached.cached.totalPages,
					nextPage: null,
					comments: [].concat(articles.commentsCached.cached.comments.page1.comments).concat(articles.commentsCached.cached.comments.page0.comments),
					lastEvent: articles.commentsCached.cached.comments.page1.lastEvent
				}, "Comments returned correctly.");
			});
		});

		it('should load cached comments if exists for a page number', function () {
			let commentsCache = new CommentsCache(articles.commentsCached.id, articles.commentsCached.siteId);

			return commentsCache.getCommentsByPage(0).then((data) => {
				assert.deepEqual(data, articles.commentsCached.cached.comments.page0, "Comments returned correctly.");
			});
		});

		it('should return 404 if the page does not exist (comments cached)', function () {
			let commentsCache = new CommentsCache(articles.commentsCached.id, articles.commentsCached.siteId);

			return commentsCache.getCommentsByPage(2).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});



		// cache down
		it('should return the comments for an existing page number (processed and ordered by recent first) even if the cache is down', function () {
			let originalMongoUri = env.mongo.uri;
			env.mongo.uri = 'invalid';

			let article = generateArticle(1);

			let commentsCache = new CommentsCache(article.id, article.siteId);

			let commentsPage0 = transformLfPage(article, 0);

			let expectedComments = {
				comments: commentsPage0.comments,
				lastEvent: commentsPage0.lastEvent,
				totalPages: 1,
				nextPage: null
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage().then((data) => {
					env.mongo.uri = originalMongoUri;

					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: article.id + '-' + article.siteId
						});

						assert.equal(commentsCacheEntry.length, 0, "Cache entry not created.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});
	});
});

