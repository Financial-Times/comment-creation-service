"use strict";

var config = {
	livefyre: {
		network: {
			name: process.env.LIVEFYRE_NETWORK_NAME
		},
		api: {
			commentsByPageUrl: process.env.LIVEFYRE_COMMENTS_BY_PAGE_URL,
			collectionInfoPlusUrl: process.env.LIVEFYRE_COLLECTION_INFO_PLUS_URL,
			createCollectionUrl: process.env.LIVEFYRE_CREATE_COLLECTION_URL,
			unfollowCollectionUrl: process.env.LIVEFYRE_UNFOLLOW_COLLECTION_URL,
			postCommentUrl: process.env.LIVEFYRE_POST_COMMENT_URL,
			deleteCommentUrl: process.env.LIVEFYRE_DELETE_COMMENT_URL
		}
	},
	mongo: {
		uri: process.env.MONGOLAB_URI
	},
	suds: {
		api: {
			getCollectionDetails: process.env.SUDS_API_GET_COLLECTION_DETAILS_URL,
			getAuth: process.env.SUDS_API_GET_AUTH
		}
	},
	logger: {
		level: process.env.LOGGER_LEVEL
	},
	cache: {
		commentsExpireInMinutes: process.env.CACHE_COMMENTS_EXPIRE_IN_MINUTES || 5
	},
	host: process.env.HOST || 'comment-creation-service.herokuapp.com',
	maintenanceModeOn: ['true', true].indexOf(process.env.MAINTENANCE_ON) !== -1 ? true : false
};

module.exports = config;
