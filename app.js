"use strict";

var express = require('express');
var path = require('path');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');
var consoleLogger = require('./app/utils/consoleLogger');
var env = require('./env');
var urlParser = require('url');

var routes = {
	v1: require('./app/routes/v1'),
	__health: require('./app/routes/__health'),
	__about: require('./app/routes/__about'),
	__gtg: require('./app/routes/__gtg'),
	troubleshoot: require('./app/routes/troubleshoot')
};


if (env.logger.level) {
	consoleLogger.setLevel(env.logger.level);
}

consoleLogger.enable();


var app = express();

var corsOptions = {
	origin: function(origin, callback) {
		if (origin) {
			var allowed = 'ft.com';
			var hostname = urlParser.parse(origin).hostname;

			callback(null, hostname.indexOf(allowed, hostname.length - allowed.length) !== -1);

			return;
		}

		callback(null, false);
	}
};

app.use(cors(corsOptions));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hjs');

//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(cookieParser());
app.use(function(req, res, next) {
	// normalize stupid tomcat cookies, which appends ",$Version=0" after the values of each cookie

	if (req.cookies) {
		for (let cookieKey in req.cookies) {
			if (req.cookies.hasOwnProperty(cookieKey)) {
				if (req.cookies[cookieKey].indexOf('$Version') !== -1) {
					req.cookies[cookieKey] = req.cookies[cookieKey].replace(/\,\$Version\=[0-9]/g, '');
				}
			}
		}
	}
	next();
});
app.use(function (req, res, next) {
	res.set('Cache-Control', 'no-cache');
	next();
});
app.use(express.static(path.join(__dirname, 'public')));

if (env.maintenanceModeOn) {
	app.all('*', function(req, res, next) {
		res.status(503).send("Maintenance");
	});
} else {
	app.use('/v1', routes.v1);
	app.use('/', routes.__health);
	app.use('/', routes.__about);
	app.use('/', routes.__gtg);
	app.use('/', routes.troubleshoot);
	app.get('/', function(req, res) {
		res.redirect('/apidoc');
	});
}


// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// error handlers

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	var status = err.status || err.statusCode || 503;

	res.status(status);
	res.render('error', {
		message: err.message,
		error: {}
	});

	if (status >= 500) {
		consoleLogger.error("ERROR", err, err.stack);
	}
});


process.on('uncaughtException', function(err) {
	consoleLogger.error('Uncaught EXCEPTION: ', err, err.stack);
});



module.exports = app;
