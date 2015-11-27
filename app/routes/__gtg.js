"use strict";

const express = require('express');
const router = express.Router();
const health = require('../health/health.js');

router.get('/__gtg', function (req, res, next) {
	var healthStatus = health.getChecks();

	if (!healthStatus) {
		res.status(503).send('Not ok');
	} else {
		res.send('Ok');
	}
});

module.exports = router;
