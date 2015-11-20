"use strict";

const _ = require('lodash');

module.exports = function (config) {
	config = config || {};
	let dbMock = config.dbMock || {};

	const findInDb = (collection, query) => {
		let keys = Object.keys(query);
		let itemsFound = [];

		dbMock[collection].forEach((item) => {
			let foundIt = true;

			keys.forEach((key) => {
				if (key === '$or') {
					let foundOr = false;

					query[key].forEach((subQuery) => {
						let foundOrSub = true;

						Object.keys(subQuery).forEach((subKey) => {
							if (item[subKey] !== subQuery[subKey]) {
								foundOrSub = false;
							}
						});

						if (foundOrSub) {
							foundOr = true;
						}
					});

					if (!foundOr) {
						foundIt = false;
					}
				} else {
					if (item[key] !== query[key]) {
						foundIt = false;
					}
				}
			});

			if (foundIt) {
				itemsFound.push(item);
			}
		});

		return itemsFound;
	};

	const removeFromDb = (collection, query) => {
		let keys = Object.keys(query);
		let i = 0;

		while (i < dbMock[collection].length) {
			let item = dbMock[collection][i];

			let match = true;

			keys.forEach((key) => {
				if (item[key] !== query[key]) {
					match = false;
				}
			});

			if (match) {
				dbMock[collection].splice(i, 1);
			} else {
				i++;
			}
		}
	};

	this.mock = {
		MongoClient: {
			connect: function (connectionString, callback) {
				if (connectionString === 'invalid') {
					callback(new Error("Connection string not valid."));
				} else {
					callback(null, {
						on: function () {},
						collection: function (collectionName) {
							if (dbMock[collectionName]) {
								return {
									find: function (query) {
										return {
											toArray(callbackFind) {
												if (query) {
													callbackFind(null, _.cloneDeep(findInDb(collectionName, query)));
												} else {
													callbackFind(new Error("Invalid query."));
													return;
												}
											}
										};
									},
									update: function (query, data, flags, callback) {
										if (typeof flags === 'function') {
											flags = null;
											callback = flags;
										}

										if (!callback) {
											callback = function () {};
										}

										if (query) {
											var found = findInDb(collectionName, query);

											if (found && found.length) {
												found.forEach(function (item) {
													if (data.$set && Object.keys(data.$set).length) {
														var dataKeys = Object.keys(data.$set);

														dataKeys.forEach((dataKey) => {
															var keys = dataKey.split('.');
															var lastKey = keys[keys.length - 1];

															var currentObj = item;
															let key;
															for (let i = 0; i < keys.length - 1; i++) {
																key = keys[i];

																if (!item[key]) {
																	item[key] = {};
																}

																currentObj = item[key];
															}

															currentObj[lastKey] = data.$set[dataKey];
														});
													} else {
														var id = found._id;
														item = data;
														item._id = id;
													}
												});

												callback(null, 1);
											} else if (flags && flags['upsert'] === true) {
												var newData;

												if (data.$set && Object.keys(data.$set).length) {
													newData = {};

													var dataKeys = Object.keys(data.$set);
													dataKeys.forEach((dataKey) => {
														var keys = dataKey.split('.');
														var lastKey = keys[keys.length - 1];

														var currentObj = newData;
														let key;
														for (let i = 0; i < keys.length - 1; i++) {
															key = keys[i];

															if (!newData[key]) {
																newData[key] = {};
															}

															currentObj = newData[key];
														}

														currentObj[lastKey] = data.$set[dataKey];
													});
												} else {
													newData = data;
												}

												if (query._id) {
													newData._id = query._id;
												}

												dbMock[collectionName].push(newData);

												callback(null, null);
											}
										} else {
											callback("Invalid data.");
										}
									},
									remove: function (query, callback) {
										if (!callback) {
											callback = function () {};
										}

										if (query) {
											removeFromDb(collectionName, query);

											callback();
										} else {
											callback("Invalid data.");
										}
									}
								};
							} else {
								throw new Error("Collection does not exist.");
							}
						}
					});
				}
			}
		},
		'@global': config.global === true ? true : false
	};

	this.getDbContent = function () {
		return dbMock;
	};

	this.findInDb = findInDb;
};
