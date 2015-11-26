"use strict";

const config = require('./config.json');
const _ = require('lodash');
const async = require('async');
const consoleLogger = require('../utils/consoleLogger');

const healthServices = [];
config.checks.forEach(function (serviceName) {
	healthServices.push(require('./healthServices/' + serviceName));
});

var inErrorState = false;

const healthStatus = _.omit(config, 'checks');
healthStatus.checks = [];

var check = function () {
	var checksToRun = [];
	healthServices.forEach(function (healthService) {
		checksToRun.push(healthService.getHealth());
	});

	Promise.all(checksToRun).then((results) => {
		inErrorState = false;
		healthStatus.checks = results;
	}).catch((err) => {
		inErrorState = true;
		consoleLogger.error('health', 'global error', err);
	});

	setTimeout(check, 30000);
};
check();


exports.getChecks = function () {
	if (inErrorState) {
		return false;
	}

	return healthStatus;
};
