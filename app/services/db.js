"use strict";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const consoleLogger = require('../utils/consoleLogger');

let connections = {};


function getConnection (uri) {
	const promise = new Promise((resolve, reject) => {
		if (connections[uri]) {
			resolve(connections[uri]);
			return;
		}

		MongoClient.connect(uri, function(err, dbConn) {
			if (err) {
				consoleLogger.warn('Mongo connection failed', err);

				reject({
					statusCode: 503,
					error: err
				});
				return;
			}

			dbConn.on('close', function() {
				consoleLogger.warn('Mongo connection lost', err);

				connections[uri] = null;

				if (this._callBackStore) {
					for(var key in this._callBackStore._notReplied) {
						if (this._callBackStore._notReplied.hasOwnProperty(key)) {
							this._callHandler(key, null, 'Connection Closed!');
						}
					}
				}
			});

			connections[uri] = dbConn;
			resolve(dbConn);
		});

		setTimeout(function () {
			reject({
				statusCode: 503,
				error: new Error("Connection timeout")
			});
		}, 10000);
	});

	return promise;
}

exports.getConnection = getConnection;
