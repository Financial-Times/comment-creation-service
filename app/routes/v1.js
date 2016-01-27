"use strict";

const express = require('express');
const router = express.Router();
const v1Controller = require('../controllers/v1');

/**
 * @api {get} v1/getComments getComments
 * @apiVersion 1.1.0
 * @apiGroup v1
 * @apiName getComments
 * @apiDescription Endpoint to get the comments of an article and the user's details.
 *
 * @apiParam {String} articleId 	Required. ID of the article.
 * @apiParam {String} url 			Required. Url of the article.
 * @apiParam {String} title 		Required. Title of the article.
 * @apiParam {String} pageNumber	Optional. Used for pagination of comments
 * @apiParam {String} tags 			Optional. Additional tags for the collection (added to the default of CAPI and URL based tags). Comma separated.
 * @apiParam {String} sessionId 	Session ID of the user. Optional, but if not present, FTSession cookie is used.
 *
 * @apiSuccess (success) {Object}		collection						Data about the article
 * @apiSuccess (success) {String}		collection.collectionId 		ID of the Livefyre collection
 * @apiSuccess (success) {Array}		collection.comments				A list of comments of the article
 * @apiSuccess (success) {Number}		collection.lastEvent 			Last Livefyre event handled by the application
 * @apiSuccess (success) {Number}		collection.totalPages 			Total number of pages of comments
 * @apiSuccess (success) {Number}		collection.nextPage				Next page of comments (pagination)
 * @apiSuccess (success) {Object}		userDetails 					Data about the user
 * @apiSuccess (success) {String}		userDetails.token 				Auth token of Livefyre. See [Livefyre documentation](http://answers.livefyre.com/developers/getting-started/tokens/auth/)
 * @apiSuccess (success) {Number}		userDetails.expires 			Timestamp of when the token expires.
 * @apiSuccess (success) {String}		userDetails.displayName 		The user's pseudonym (nickname).
 * @apiSuccess (success) {Object}		userDetails.settings 			The user's email notification settings.
 * @apiSuccess (success) {Object}		userDetails.moderationRights 	Moderation rights of the user
 * @apiSuccess (success) {Boolean}		userDetails.moderator 			Whether the user is moderator or not.
 *
 * @apiSuccess (unclassified) {Object} 		collection 						Data about the article
 * @apiSuccess (unclassified) {Boolean} 	collection.unclassifiedArticle 	Relates to the legacy mapping of articles to different sites based on primary section/URL. If the URL was not mapped by the legacy mapping logic, flag it.
 *
 * @apiSuccess (no pseudonym) {Object} 		userDetails				Data about the user
 * @apiSuccess (no pseudonym) {Boolean} 	userDetails.pseudonym 	Pseudonym false is the flag that the user does not have a pseudonym yet.
 *
 *
 * @apiSuccessExample Full response
 *  HTTP/1.1 200 OK
 *   collection: {
 *   	collectionId: "151521626",
 *    		comments: [
 *      		{
 *        			parentId: "",
 *           		author: {
 *             			id: "5234343@ft.fyre.co",
 *                		displayName: "pseudonym",
 *                  	tags: [ ],
 *                   	type: 1
 *                  },
 *                  content: "<p>test</p>",
 *                  timestamp: 1453813771,
 *                  commentId: "634534523",
 *                  visibility: 1
 *               }
 *          ],
 *          lastEvent: 1453813771483100,
 *          totalPages: 1,
 *          nextPage: null
 *      },
 *      userDetails: {
 *      	token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJmdC5meXJlLmNvIiwidXNlcl9pZCI6IjkwMjY1MDIiLCJkaXNwbGF5X25hbWUiOiJyb2xpIG1haW4iLCJleHBpcmVzIjoxNDY4MzMyMjU2Ljk1NSwiaWF0IjoxNDUzNzk2Mjc5fQ.LIxHm5cpDgVLVteoZaK9ZNn7yjMGPRt8RjACc2vlSVk",
 *       	expires: 1468332257705,
 *        	displayName: "roli main",
 *         	moderationRights: {
 *          	collections: [ ],
 *           	networks: [
 *          	 	"ft-2.fyre.co"
 *             	],
 *              sites: [
 *          	   "3634533"
 *              ]
 *          },
 *          settings: {
 *      	   	emailcomments: "never",
 *       	  	emaillikes: "never",
 *        	 	emailreplies: "never",
 *         		emailautofollow: "off"
 *           },
 *           moderator: true
 *      }
 * }
 *
 *
 *
 * @apiSuccessExample Unclassified article
 *  HTTP/1.1 200 OK
 *   {
 *      "collection": {
 *          "unclassified": true
 *      },
 *      "userDetails": {
 *          ....
 *      }
 *   }
 *
 * @apiSuccessExample No pseudonym
 *  HTTP/1.1 200 OK
 *   {
 *      "collection": {
 *          ...
 *      },
 *      "userDetails": {
 *          "pseudonym": false
 *      }
 *   }
 */
router.get('/getComments', v1Controller.getComments);

/**
 * @api {get / post} v1/postComment postComment
 * @apiVersion 1.1.0
 * @apiGroup v1
 * @apiName postComment
 * @apiDescription Endpoint to post a comment.
 *
 * @apiParam {Number} 			collectionId 	Required. ID of the article.
 * @apiParam {String} 			commentBody 	Required. Url of the article.
 * @apiParam {String} 			token 			Required. Title of the article.
 * @apiParam {String} 			sessionId		Session ID of the user. Optional, but if not present, FTSession cookie is used.
 *
 * @apiSuccess (success) {Boolean}		success				Whether the response is a success or not.
 * @apiSuccess (success) {String}		status 				Textual representation of the status of the response
 * @apiSuccess (success) {Number}		code 				HTTP status code of the response
 * @apiSuccess (success) {String}		bodyHtml			The content of the comment posted.
 * @apiSuccess (success) {String}		commentId 			ID of the comment.
 * @apiSuccess (success) {Number}		createdAt			Timestamp of the creation date of the comment
 * @apiSuccess (success) {Boolean}		invalidSession 		Whether the user's session is valid or not.
 *
 * @apiError (unclassified) {Boolean} 		success 		Whether the response is a success or not.
 * @apiError (unclassified) {String} 		status 			Textual representation of the status of the response
 * @apiError (unclassified) {Number} 		code 			HTTP status code of the response
 * @apiError (unclassified) {String} 		errorMessage 	The error message
 * @apiError (unclassified) {Boolean} 		invalidSession 	Whether the user's session is valid or not.
 *
 * @apiSuccessExample Full response
 *  HTTP/1.1 200 OK
 *   {
 *   	"bodyHtml": "<p>101</p>",
 *   	"commentId": "450210605",
 *     	"createdAt": 1453884494,
 *     	"status": "ok",
 *     	"code": 200,
 *      "success": true,
 *      "invalidSession": false
 *   }
 *
 *
 *
 * @apiErrorExample Unclassified article
 *  HTTP/1.1 401 Not authorized
 *   {
 *   	"success": false,
 *   	"status": "error",
 *   	"code": 401,
 *   	"errorMessage": "User session is not valid.",
 *   	"invalidSession": true
 *   }
 *
 */
router.get('/postComment', v1Controller.postComment);
router.post('/postComment', v1Controller.postComment);


/**
 * @api {get / post} v1/deleteComment deleteComment
 * @apiVersion 1.1.0
 * @apiGroup v1
 * @apiName deleteComment
 * @apiDescription Endpoint to post a comment.
 *
 * @apiParam {Number} 			collectionId 	Required. ID of the article.
 * @apiParam {String} 			commentBody 	Required. Url of the article.
 * @apiParam {String} 			token 			Required. Title of the article.
 * @apiParam {String} 			sessionId		Session ID of the user. Optional, but if not present, FTSession cookie is used.
 *
 * @apiSuccess (success) {Boolean}		success				Whether the response is a success or not.
 * @apiSuccess (success) {String}		status 				Textual representation of the status of the response
 * @apiSuccess (success) {Number}		code 				HTTP status code of the response
 * @apiSuccess (success) {Boolean}		invalidSession 		Whether the user's session is valid or not.
 *
 * @apiError (unclassified) {Boolean} 		success 		Whether the response is a success or not.
 * @apiError (unclassified) {String} 		status 			Textual representation of the status of the response
 * @apiError (unclassified) {Number} 		code 			HTTP status code of the response
 * @apiError (unclassified) {String} 		errorMessage 	The error message
 * @apiError (unclassified) {Boolean} 		invalidSession 	Whether the user's session is valid or not.
 *
 * @apiSuccessExample Full response
 *  HTTP/1.1 200 OK
 *   {
 *   	"status": "ok",
 *   	"code": 200,
 *   	"success": true,
 *   	"invalidSession": false
 *   }
 *
 *
 *
 * @apiErrorExample Unclassified article
 *  HTTP/1.1 401 Not authorized
 *   {
 *   	"success": false,
 *   	"status": "error",
 *   	"code": 401,
 *   	"errorMessage": "User session is not valid.",
 *   	"invalidSession": true
 *   }
 *
 */
router.get('/deleteComment', v1Controller.deleteComment);
router.delete('/deleteComment', v1Controller.deleteComment);

module.exports = router;
