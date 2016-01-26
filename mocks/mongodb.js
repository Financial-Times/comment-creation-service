"use strict";

const _ = require('lodash');

module.exports = function (config) {
	config = config || {};
	let dbMock = config.dbMock || {};


	const match = function (item, query) {
		let keys = Object.keys(query);
		let foundIt = true;

		keys.forEach((key) => {
			if (key === '$or') {
				let foundOr = false;

				query[key].forEach((subQuery) => {
					let foundOrSub = true;

					Object.keys(subQuery).forEach((subKey) => {
						let itemToCheck = item;
						let keys = subKey.split('.');

						for (let i = 0; i < keys.length; i++) {
							itemToCheck = itemToCheck[keys[i]];
						}

						if (itemToCheck !== subQuery[subKey]) {
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
				let itemToCheck = item;
				let keys = key.split('.');

				for (let i = 0; i < keys.length; i++) {
					itemToCheck = itemToCheck[keys[i]];
				}

				if (itemToCheck !== query[key]) {
					foundIt = false;
				}
			}
		});

		return foundIt;
	};

	const findInDb = (collection, query) => {
		let itemsFound = [];

		dbMock[collection].forEach((item) => {
			if (match(item, query)) {
				itemsFound.push(item);
			}
		});

		return itemsFound;
	};

	const removeFromDb = (collection, query) => {
		let i = 0;

		while (i < dbMock[collection].length) {
			let item = dbMock[collection][i];

			if (match(item, query)) {
				dbMock[collection].splice(i, 1);
			} else {
				i++;
			}
		}
	};

	this.mock = {
		MongoClient: {
			connect: function (connectionString, options, callback) {
				if (connectionString === 'invalid') {
					callback(new Error("Connection string not valid."));
				} else {
					callback(null, {
						on: function () {},
						collection: function (collectionName) {
							if (dbMock[collectionName]) {
								return {
									find: function (query) {
										var toArray = function (callbackFind) {
											if (query) {
												callbackFind(null, _.cloneDeep(findInDb(collectionName, query)));
											} else {
												callbackFind(new Error("Invalid query."));
												return;
											}
										};
										return {
											maxTimeMS: function () {
												return {
													toArray: toArray
												};
											},
											toArray: toArray
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

																if (!currentObj[key]) {
																	currentObj[key] = {};
																}

																currentObj = currentObj[key];
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

															if (!currentObj[key]) {
																currentObj[key] = {};
															}

															currentObj = currentObj[key];
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
