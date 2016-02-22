"use strict";

const _ = require('lodash');
const db = require('../../services/db');
const env = require('../../../env');
const consoleLogger = require('../../utils/consoleLogger');

const healthCheckModel = {
	id: 'mongodb',
	name: 'Mongo DB connection',
	ok: false,
	technicalSummary: "MongoDB is used to store information about the collections and comments",
	severity: 2,
	businessImpact: "The system is working, but it may be slower due to the lack of caching.",
	checkOutput: "",
	panicGuide: "http://"+ env.host +"/troubleshoot",
	lastUpdated: new Date().toISOString()
};

exports.getHealth = function (callback) {
	var currentHealth = _.clone(healthCheckModel);

	return new Promise((resolve, reject) => {
		db.getConnection(env.mongo.uri).then((connection) => {
			connection.collection('collections').find({
				_id: '556ce131-35fb-3eb4-b2ee-27277e897660'
			}, function (errQuery) {
				if (errQuery) {
					currentHealth.ok = false;
					currentHealth.checkOutput = "Error while making a query. See the logs of the application on heroku.";
					resolve(currentHealth);
					return;
				}

				currentHealth.ok = true;
				resolve(_.omit(currentHealth, ['checkOutput']));
			});
		}).catch((err) => {
			currentHealth.ok = false;
			currentHealth.checkOutput = "Connection is down. See the logs of the application on heroku.";

			resolve(currentHealth);
		});

		// timeout after 15 seconds
		setTimeout(function () {
			currentHealth.ok = false;
			currentHealth.checkOutput = 'timeout';

			resolve(currentHealth);
		}, 15000);
	}).catch((err) => {
		consoleLogger.error('health', 'livefyreApi', 'Exception', err);
		currentHealth.ok = false;
		currentHealth.checkOutput = 'Exception';

		return currentHealth;
	});;
};
