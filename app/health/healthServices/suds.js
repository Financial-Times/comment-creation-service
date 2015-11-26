"use strict";

const _ = require('lodash');
const sudsService = require('../../services/suds');
const env = require('../../../env');
const consoleLogger = require('../../utils/consoleLogger');
const async = require('async');

const healthCheckModel = {
	name: 'SUDS API',
	ok: false,
	technicalSummary: "SUDS is used to fetch information about an article's siteID mapping and metadata for the collection creation.",
	severity: 2,
	businessImpact: "New collections could not be created. Authentication will not work, but comments will be available for collections that were visited at least once.",
	checkOutput: "",
	panicGuide: "http://"+ env.host +"/troubleshoot",
	lastUpdated: new Date().toISOString()
};

exports.getHealth = function (callback) {
	var currentHealth = _.clone(healthCheckModel);

	return new Promise((resolve, reject) => {
		Promise.all([
			(function () {
				return sudsService.getCollectionDetails({
					articleId: '556ce131-35fb-3eb4-b2ee-27277e897660',
					url: 'http://ftalphaville.ft.com/marketslive/2013-11-25/',
					title: 'Markets Live: Monday, 25th November, 2013'
				}).catch((err) => {
					throw 'getCollectionDetails, statusCode: ' + err.statusCode;
				});
			}()),
			(function () {
				return sudsService.getAuth('aSessionId').then((data) => {
					if (data && data.hasOwnProperty('serviceUp') && data.serviceUp === false) {
						throw 'getAuth, service down';
					} else {
						return;
					}
				}, (err) => {
					if (err.statusCode === 401) {
						// is considered a healthy response
						return;
					} else {
						throw 'getAuth, statusCode: ' + err.statusCode;
					}
				});
			}())
		]).then(() => {
			currentHealth.ok = true;

			resolve(_.pick(currentHealth, ['name', 'ok', 'lastUpdated']));
		}).catch((err) => {
			currentHealth.ok = false;
			currentHealth.checkOutput = err;

			resolve(currentHealth);
		});


		// timeout after 15 seconds
		setTimeout(function () {
			currentHealth.ok = false;
			currentHealth.checkOutput = 'timeout';
			resolve(currentHealth);
			return;
		}, 15000);
	}).catch((err) => {
		consoleLogger.error('health', 'suds', 'Exception', err);
		currentHealth.ok = false;
		currentHealth.checkOutput = 'Exception';

		return currentHealth;
	});
};
