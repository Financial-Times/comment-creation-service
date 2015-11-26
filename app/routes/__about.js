"use strict";

const express = require('express');
const router = express.Router();
const env = require('../../env');


var controller = function (req, res, next) {
	res.jsonp({
		name: "session-user-data-service",
		versions: [
			env.host + "/v1"
		]
	});
};

router.get('/__about', controller);

module.exports = router;
