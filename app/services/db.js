"use strict";

const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const consoleLogger = require('../utils/consoleLogger');
const Timer = require('../utils/Timer');
const EventEmitter = require('events');

const endTimer = function (timer) {
	let elapsedTime = timer.getElapsedTime();
	if (elapsedTime > 5000) {
		consoleLogger.warn('db.getConnection: service high response time', elapsedTime + 'ms');
	} else {
		consoleLogger.info('db.getConnection: service response time', elapsedTime + 'ms');
	}
};

let connections = {};
const evts = new EventEmitter();
let connectionInProgress = {};


function getConnection (uri) {
	const promise = new Promise((resolve, reject) => {
		if (connections[uri]) {
			resolve(connections[uri]);
			return;
		}


		let eventHandled = false;
		evts.once('complete', function (err, conn) {
			if (!eventHandled) {
				eventHandled = true;
				connectionInProgress[uri] = false;

				if (err) {
					reject(err);
				} else {
					resolve(conn);
				}
			}
		});


		if (!connectionInProgress[uri]) {
			connectionInProgress[uri] = true;

			let timer = new Timer();

			MongoClient.connect(uri, function(err, dbConn) {
				endTimer(timer);

				if (err) {
					consoleLogger.warn('Mongo connection failed', err);

					evts.emit('complete', err);

					return;
				}

				connections[uri] = dbConn;
				evts.emit('complete', null, dbConn);
			});
		}
	});

	return promise;
}

exports.getConnection = getConnection;
