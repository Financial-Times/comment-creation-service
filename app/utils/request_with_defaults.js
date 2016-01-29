"use strict";

const env = require('../../env');
const request = require('request');

module.exports = request.defaults({
	timeout: env.timeouts.services
});
