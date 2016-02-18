"use strict";

const request = require('../utils/request_with_defaults.js');
const consoleLogger = require('../utils/consoleLogger');
const env = require('../../env');

var spamFilterUrl = env.spamFilter.api.whitelistCollection.replace(/\{apiKey\}/g, env.spamFilter.key);

exports.whitelistCollection = function (collectionId) {
	const promise = new Promise((resolve, reject) => {
		if (!collectionId) {
			reject({
				statusCode: 400,
				error: new Error('"collectionId" should be provided.'),
				safeMessage: true
			});
			return;
		}

		request.post(spamFilterUrl, {
			form: {
				collectionId: collectionId
			}
		}, function (err, response) {
			if (err || !response || response.statusCode < 200 || response.statusCode >= 400) {
				if (err || !response || response.statusCode !== 404) {
					consoleLogger.warn('spamFilter.whitelistCollection error', err || new Error(response ? response.statusCode : 'No response'));
				}

				reject({
					error: err,
					responseBody: null,
					statusCode: response && response.statusCode ? response.statusCode : 503
				});
				return;
			}

			resolve();
		});
	});

	return promise;
};
