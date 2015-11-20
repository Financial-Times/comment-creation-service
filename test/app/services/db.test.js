"use strict";

const assert = require('assert');
const proxyquire =  require('proxyquire');
const consoleLogger = require('../../../app/utils/consoleLogger');
const MongodbMock = require('../../../mocks/mongodb');

consoleLogger.disable();

const db = proxyquire('../../../app/services/db.js', {
	'mongodb': new MongodbMock().mock
});

describe('db', function() {
	describe('getConnection', function () {
		it('should return an error when invalid connection string is provided', function () {
			return db.getConnection('invalid').then(() => {
				assert.fail("Should not enter 'then'.");
			}, (err) => {
				assert.ok(err, "Error is returned.");
			});
		});

		it('should return the connection object if a connection can be established', function () {
			return db.getConnection('valid').then((connection) => {
				assert.ok(connection && typeof connection === 'object', "Connection object is returned.");

				return db.getConnection('valid').then((connectionSubs) => {
					assert.equal(connectionSubs, connection, "Subsequent request: The connection object on subsequent request is the same (cached).");
				}, (err) => {
					assert.fail("Should not enter 'catch'.");
				});
			}, (err) => {
				assert.fail("Should not enter 'catch'.");
			});
		});
	});
});
