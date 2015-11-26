"use strict";

const express = require('express');
const router = express.Router();
const health = require('../health/health.js');



var controller = function (req, res, next) {
	var healthStatus = health.getChecks();

	if (!healthStatus) {
		res.sendStatus(503);
	} else {
		res.jsonp(healthStatus);
	}
};
router.get('/__health', controller);
router.get('/__health.json', controller);

module.exports = router;
