"use strict";

const express = require('express');
const router = express.Router();


router.get('/troubleshooting', function (req, res, next) {
	res.redirect('https://docs.google.com/document/d/1fO83L0em4XjC-495O4shWn4BtTefRzUYbjZhMj0_vuY');
});

module.exports = router;
