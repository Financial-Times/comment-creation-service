"use strict";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const consoleLogger = require('../utils/consoleLogger');
const Timer = require('../utils/Timer');

const endTimer = function (timer, uuid) {
	let elapsedTime = timer.getElapsedTime();
	if (elapsedTime > 5000) {
		consoleLogger.warn(uuid, 'db.getConnection: service high response time', elapsedTime + 'ms');
	} else {
		consoleLogger.info(uuid, 'db.getConnection: service response time', elapsedTime + 'ms');
	}
};




let connections = {};


function getConnection (uri) {
	const promise = new Promise((resolve, reject) => {
		if (connections[uri]) {
			resolve(connections[uri]);
			return;
		}

		let timer = new Timer();

		MongoClient.connect(uri, function(err, dbConn) {
			endTimer(timer);

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
