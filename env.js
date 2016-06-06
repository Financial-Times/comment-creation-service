"use strict";

var config = {
	livefyre: {
		network: {
			name: process.env.LIVEFYRE_NETWORK_NAME,
			key: process.env.LIVEFYRE_NETWORK_KEY
		},
		api: {
			commentsByPageUrl: process.env.LIVEFYRE_COMMENTS_BY_PAGE_URL,
			collectionInfoPlusUrl: process.env.LIVEFYRE_COLLECTION_INFO_PLUS_URL,
			createCollectionUrl: process.env.LIVEFYRE_CREATE_COLLECTION_URL,
			unfollowCollectionUrl: process.env.LIVEFYRE_UNFOLLOW_COLLECTION_URL,
			postCommentUrl: process.env.LIVEFYRE_POST_COMMENT_URL,
			deleteCommentUrl: process.env.LIVEFYRE_DELETE_COMMENT_URL,
			changeCollectionUrl: process.env.LIVEFYRE_CHANGE_COLLECTION_URL
		},
		defaultSiteId: process.env.LIVEFYRE_DEFAULT_SITE_ID
	},
	mongo: {
		uri: process.env.MONGOLAB_URI
	},
	suds: {
		api: {
			getCollectionDetails: process.env.SUDS_API_GET_COLLECTION_DETAILS_URL,
			getAuth: process.env.SUDS_API_GET_AUTH,
			getSiteId: process.env.SUDS_API_GET_SITE_ID
		}
	},
	spamFilter: {
		api: {
			whitelistCollection: process.env.SPAM_FILTER_API_COLLECTION_WHITELIST
		},
		key: process.env.SPAM_FILTER_API_KEY
	},
	logger: {
		level: process.env.LOGGER_LEVEL
	},
	cache: {
		commentsExpireInMinutes: process.env.CACHE_COMMENTS_EXPIRE_IN_MINUTES || 5
	},
	timeouts: {
		services: process.env.SERVICES_TIMEOUT && parseInt(process.env.SERVICES_TIMEOUT, 10) ? parseInt(process.env.SERVICES_TIMEOUT, 10) : 15000,
		queries: process.env.DB_QUERIES_TIMEOUT && parseInt(process.env.DB_QUERIES_TIMEOUT, 10) ? parseInt(process.env.DB_QUERIES_TIMEOUT, 10) : 10000,
	},
	host: process.env.HOST || 'comment-creation-service.herokuapp.com',
	maintenanceModeOn: ['true', true].indexOf(process.env.MAINTENANCE_ON) !== -1 ? true : false
};

module.exports = config;
