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
			commentsByPageUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/commentsByPageUrl/{pageNumber}.json',
			collectionInfoPlusUrl: 'http://{networkName}.fyre.co/{siteId}/article/{articleIdBase64}/collectionInfoPlusUrl'
		}
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
			createdAt: new Date()
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
	noPages: {
		id: 'fee235a5-9391-4f58-8435-212f31d9866e',
		siteId: 524235,
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				archiveInfo: {
					nPages: 0
				}
			}
		}
	},
	onePage: {
		id: '524488fe-f1e9-4991-a467-b0ae33d7d5b3',
		siteId: 745344,
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				archiveInfo: {
					nPages: 1
				}
			}
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
			}
		}
	},
	twoPages: {
		id: '5a70daee-b06b-4eaa-99db-e8b11cbc351f',
		siteId: 345345,
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				archiveInfo: {
					nPages: 2
				}
			}
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
			}
		}
	},
	threePages: {
		id: '4d2f9428-956e-43cf-a8c0-94b761afa68c',
		siteId: 6345345,
		collectionInfo: {
			headDocument: [],
			collectionSettings: {
				archiveInfo: {
					nPages: 3
				}
			}
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
	}
};

const byArticleId = {};
Object.keys(articles).forEach((key) => {
	byArticleId[articles[key].id] = articles[key];
});

const needleMock = new NeedleMock({
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

				let article = byArticleId[articleId];
				if (article && article.collectionInfo && String(article.siteId) === String(config.matches.urlParams.siteId)) {
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
		}
	],
	global: true
});

const mongodbMock = new MongodbMock({
	dbMock: {
		comments: []
	},
	global: true
});


const CommentsCache = proxyquire('../../../app/storage/CommentsCache.js', {
	'needle': needleMock.mock,
	'../../env': env,
	mongodb: mongodbMock.mock
});

describe('CommentsCache', function () {
	describe('getCommentsByPage', function () {
		it('should return error if `articleId` is not provided', function () {
			let commentsCache = new CommentsCache();

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if `siteId` is not provided', function () {
			let commentsCache = new CommentsCache('articleId');

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if `pageNumber` is not provided', function () {
			let commentsCache = new CommentsCache('articleId', 'siteId');

			return commentsCache.getCommentsByPage().then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 400, "Status code is correct.");
			});
		});

		it('should return error if a service is down', function () {
			let commentsCache = new CommentsCache('service-down', 'siteId');

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 503, "Status code is correct.");
			});
		});

		it('should return error if the article/collection is not found', function () {
			let commentsCache = new CommentsCache('not found', 'siteId');

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should return empty array if there are no comments and page number is 0', function () {
			let commentsCache = new CommentsCache(articles.noPages.id, articles.noPages.siteId);

			return commentsCache.getCommentsByPage(0).then((data) => {
				assert.deepEqual(data, {
					comments: [],
					lastEvent: 0,
					totalPages: 0,
					nextPage: null
				}, "Comments returned correctly.");
			});
		});

		it('should return 404 if there are no comments and page number is 1', function () {
			let commentsCache = new CommentsCache(articles.noPages.id, articles.noPages.siteId);

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});

		it('should fetch totalPages and comments and cache it', function () {
			let commentsCache = new CommentsCache(articles.noPages.id, articles.noPages.siteId);

			return new Promise((resolve, reject) => {
				return commentsCache.getCommentsByPage(0).then(() => {
					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: articles.noPages.id + '-' + articles.noPages.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: articles.noPages.id + '-' + articles.noPages.siteId,
							lfTotalPages: 0,
							cache: {
								comments: {
									page0: {
										comments: [],
										lastEvent: 0,
										totalPages: 0,
										nextPage: null
									}
								}
							}
						}, "Comments total pages correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});



		it('should return the comments for an existing page number (processed and ordered by recent first)', function () {
			let commentsCache = new CommentsCache(articles.onePage.id, articles.onePage.siteId);


			let expectedComments = {
				comments: [
					transformLfComment(articles.twoPages.comments[0].content[1], articles.twoPages.comments[0].authors['author2']),
					transformLfComment(articles.twoPages.comments[0].content[0], articles.twoPages.comments[0].authors['author1'])
				],
				lastEvent: 3,
				totalPages: 1,
				nextPage: null
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(0).then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: articles.onePage.id + '-' + articles.onePage.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: articles.onePage.id + '-' + articles.onePage.siteId,
							lfTotalPages: 1,
							cache: {
								comments: {
									page0: expectedComments
								}
							}
						}, "Comments total pages correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if there are no comments and page number is 1', function () {
			let commentsCache = new CommentsCache(articles.onePage.id, articles.onePage.siteId);

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});



		it('should combine the last 2 pages if there are 2 pages in total', function () {
			let commentsCache = new CommentsCache(articles.twoPages.id, articles.twoPages.siteId);


			let expectedComments = {
				comments: [
					transformLfComment(articles.twoPages.comments[1].content[0], articles.twoPages.comments[0].authors['author1']),
					transformLfComment(articles.twoPages.comments[0].content[1], articles.twoPages.comments[0].authors['author2']),
					transformLfComment(articles.twoPages.comments[0].content[0], articles.twoPages.comments[0].authors['author1'])
				],
				lastEvent: 5,
				totalPages: 1,
				nextPage: null
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(0).then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: articles.twoPages.id + '-' + articles.twoPages.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: articles.twoPages.id + '-' + articles.twoPages.siteId,
							lfTotalPages: 2,
							cache: {
								comments: {
									page0: expectedComments
								}
							}
						}, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if there are no comments and page number is 1', function () {
			let commentsCache = new CommentsCache(articles.twoPages.id, articles.twoPages.siteId);

			return commentsCache.getCommentsByPage(1).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});



		it('should combine the last 2 pages if there are 3 pages', function () {
			let commentsCache = new CommentsCache(articles.threePages.id, articles.threePages.siteId);


			let expectedComments = {
				comments: [
					transformLfComment(articles.threePages.comments[2].content[1], articles.threePages.comments[0].authors['author1']),
					transformLfComment(articles.threePages.comments[2].content[0], articles.threePages.comments[0].authors['author1']),
					transformLfComment(articles.threePages.comments[1].content[0], articles.threePages.comments[0].authors['author1']),
				],
				lastEvent: 7,
				totalPages: 2,
				nextPage: 1
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(0).then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: articles.threePages.id + '-' + articles.threePages.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(_.omit(commentsCacheEntry[0], 'expireAt'), {
							_id: articles.threePages.id + '-' + articles.threePages.siteId,
							lfTotalPages: 3,
							cache: {
								comments: {
									page0: expectedComments
								}
							}
						}, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return the next page but fetching the last "-2-pageNumber page"', function () {
			let commentsCache = new CommentsCache(articles.threePages.id, articles.threePages.siteId);


			let expectedComments = {
				comments: [
					transformLfComment(articles.threePages.comments[0].content[1], articles.threePages.comments[0].authors['author2']),
					transformLfComment(articles.threePages.comments[0].content[0], articles.threePages.comments[0].authors['author1'])
				],
				lastEvent: 3,
				totalPages: 2,
				nextPage: null
			};


			return new Promise((resolve, reject) => {
				commentsCache.getCommentsByPage(1).then((data) => {
					assert.deepEqual(data, expectedComments, "Comments returned correctly.");

					setTimeout(() => {
						var commentsCacheEntry = mongodbMock.findInDb('comments', {
							_id: articles.threePages.id + '-' + articles.threePages.siteId
						});

						assert.equal(commentsCacheEntry.length, 1, "Cache entry created.");
						assert.deepEqual(commentsCacheEntry[0].cache.comments.page1, expectedComments, "Comments correctly cached.");

						resolve();
					}, 10);
				}).catch(reject);
			});
		});

		it('should return 404 if there are no comments and page number is 2', function () {
			let commentsCache = new CommentsCache(articles.threePages.id, articles.threePages.siteId);

			return commentsCache.getCommentsByPage(2).then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
				assert.equal(err.statusCode, 404, "Status code is correct.");
			});
		});


		// total pages cached
		// cached all
	});
});
