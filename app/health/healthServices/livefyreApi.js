"use strict";

const _ = require('lodash');
const livefyreService = require('../../services/livefyre');
const env = require('../../../env');
const consoleLogger = require('../../utils/consoleLogger');

const healthCheckModel = {
	name: 'Livefyre API',
	ok: false,
	technicalSummary: "Livefyre API is used to create collections and get details about the existing ones, also to get, post and delete comments.",
	severity: 1,
	businessImpact: "New collections could not be created. Comments cannot be retrieved, posted and deleted.",
	checkOutput: "",
	panicGuide: "http://"+ env.host +"/troubleshoot",
	lastUpdated: new Date().toISOString()
};

exports.getHealth = function (callback) {
	var currentHealth = _.clone(healthCheckModel);

	return new Promise((resolve, reject) => {
		Promise.all([
			(function () {
				return livefyreService.getCollectionInfoPlus({
					articleId: '556ce131-35fb-3eb4-b2ee-27277e897660',
					siteId: 359893
				}).catch((err) => {
					throw 'getCollectionInfoPlus, statusCode: ' + err.statusCode;
				});
			}()),
			(function () {
				return livefyreService.getCommentsByPage({
					articleId: '556ce131-35fb-3eb4-b2ee-27277e897660',
					siteId: 359893,
					pageNumber: 0
				}).catch((err) => {
					throw 'getCommentsByPage, statusCode: ' + err.statusCode;
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
		consoleLogger.error('health', 'livefyreApi', 'Exception', err);
		currentHealth.ok = false;
		currentHealth.checkOutput = 'Exception';

		return currentHealth;
	});
};
