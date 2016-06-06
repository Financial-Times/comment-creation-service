"use strict";

const db = require('../services/db');
const consoleLogger = require('../utils/consoleLogger');
const mongoSanitize = require('mongo-sanitize');
const env = require('../../env');

exports.validate = function (apiKey) {
	return db.getConnection(env.mongo.uri).then((connection) => {
		return new Promise((resolve, reject) => {
			connection.collection('apiKeys').find({
				_id: mongoSanitize(apiKey)
			}).maxTimeMS(env.timeouts.queries).toArray(function (errDb, data) {
				if (errDb) {
					consoleLogger.warn('error validating the api key', errDb);
					reject(errDb);
					return;
				}

				if (data && data.length) {
					resolve(true);
				} else {
					resolve(false);
				}
			});
		});
	});
};
