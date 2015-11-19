"use strict";

const express = require('express');
const router = express.Router();
const v1Controller = require('../controllers/v1');

router.get('/getComments', v1Controller.getComments);

router.get('/postComment', v1Controller.postComment);
router.post('/postComment', v1Controller.postComment);

router.get('/deleteComment', v1Controller.deleteComment);
router.delete('/deleteComment', v1Controller.deleteComment);

module.exports = router;
