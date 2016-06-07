"use strict";

module.exports = function (config) {
	config = config || {};

	this.mock = {
		getNetwork: function (networkName, networkKey) {
			return {
				buildLivefyreToken: function () {
					return config.systemToken;
				}
			};
		},
		'@global': config.global === true ? true : false
	};
};
