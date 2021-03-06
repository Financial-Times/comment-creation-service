define({ "api": [
  {
    "type": "get / post",
    "url": "v1/closeCollection",
    "title": "Close collection",
    "version": "1.1.0",
    "group": "v1",
    "name": "closeCollection",
    "description": "<p>Closes a collection for new comments.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "articleId",
            "description": "<p>ID of the article</p>"
          }
        ]
      }
    },
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "X-Api-Key",
            "description": "<p>Access API key.</p>"
          }
        ]
      }
    },
    "success": {
      "examples": [
        {
          "title": "Success",
          "content": "HTTP/1.1 200 OK\n {\n     \"success\": true,\n     \"status\": \"ok\",\n }",
          "type": "json"
        },
        {
          "title": "Collection not found",
          "content": "HTTP/1.1 404 Not found\n {\n     \"success\": false,\n     \"status\": \"error\",\n     \"error\": \"Collection not found.\"\n }",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "No articleId",
          "content": "HTTP/1.1 400 Bad request\n {\n     \"success\": false,\n     \"status\": \"error\",\n     \"error\": \"'articleId' should be provided.\"\n }",
          "type": "400"
        },
        {
          "title": "No API key",
          "content": "HTTP/1.1 400 Bad request\n {\n     \"success\": false,\n     \"status\": \"error\",\n     \"error\": \"The API key is missing.\"\n }",
          "type": "400"
        },
        {
          "title": "API key invalid",
          "content": "HTTP/1.1 401 Unauthorized\n {\n     \"success\": false,\n     \"status\": \"error\",\n     \"error\": \"The API key is invalid.\"\n }",
          "type": "401"
        }
      ]
    },
    "filename": "app/routes/v1.js",
    "groupTitle": "v1"
  },
  {
    "type": "get / post",
    "url": "v1/deleteComment",
    "title": "deleteComment",
    "version": "1.1.0",
    "group": "v1",
    "name": "deleteComment",
    "description": "<p>Endpoint to post a comment.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "collectionId",
            "description": "<p>Required. ID of the collection.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "commentBody",
            "description": "<p>Required. Body of the comment.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "sessionId",
            "description": "<p>Session ID of the user. Optional, but if not present, FTSession cookie is used.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "success": [
          {
            "group": "success",
            "type": "Boolean",
            "optional": false,
            "field": "success",
            "description": "<p>Whether the response is a success or not.</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "status",
            "description": "<p>Textual representation of the status of the response</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "code",
            "description": "<p>HTTP status code of the response</p>"
          },
          {
            "group": "success",
            "type": "Boolean",
            "optional": false,
            "field": "invalidSession",
            "description": "<p>Whether the user's session is valid or not.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Full response",
          "content": "HTTP/1.1 200 OK\n {\n \t\"status\": \"ok\",\n \t\"code\": 200,\n \t\"success\": true,\n \t\"invalidSession\": false\n }",
          "type": "json"
        }
      ]
    },
    "error": {
      "fields": {
        "unclassified": [
          {
            "group": "unclassified",
            "type": "Boolean",
            "optional": false,
            "field": "success",
            "description": "<p>Whether the response is a success or not.</p>"
          },
          {
            "group": "unclassified",
            "type": "String",
            "optional": false,
            "field": "status",
            "description": "<p>Textual representation of the status of the response</p>"
          },
          {
            "group": "unclassified",
            "type": "Number",
            "optional": false,
            "field": "code",
            "description": "<p>HTTP status code of the response</p>"
          },
          {
            "group": "unclassified",
            "type": "String",
            "optional": false,
            "field": "errorMessage",
            "description": "<p>The error message</p>"
          },
          {
            "group": "unclassified",
            "type": "Boolean",
            "optional": false,
            "field": "invalidSession",
            "description": "<p>Whether the user's session is valid or not.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Unclassified article",
          "content": "HTTP/1.1 401 Not authorized\n {\n \t\"success\": false,\n \t\"status\": \"error\",\n \t\"code\": 401,\n \t\"errorMessage\": \"User session is not valid.\",\n \t\"invalidSession\": true\n }",
          "type": "json"
        }
      ]
    },
    "filename": "app/routes/v1.js",
    "groupTitle": "v1"
  },
  {
    "type": "get",
    "url": "v1/getComments",
    "title": "getComments",
    "version": "1.1.0",
    "group": "v1",
    "name": "getComments",
    "description": "<p>Endpoint to get the comments of an article and the user's details.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "articleId",
            "description": "<p>Required. ID of the article.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "url",
            "description": "<p>Required. Url of the article.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "title",
            "description": "<p>Required. Title of the article.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "pageNumber",
            "description": "<p>Optional. Used for pagination of comments</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "tags",
            "description": "<p>Optional. Additional tags for the collection (added to the default of CAPI and URL based tags). Comma separated.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "sessionId",
            "description": "<p>Session ID of the user. Optional, but if not present, FTSession cookie is used.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "success": [
          {
            "group": "success",
            "type": "Object",
            "optional": false,
            "field": "collection",
            "description": "<p>Data about the article</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "collection.collectionId",
            "description": "<p>ID of the Livefyre collection</p>"
          },
          {
            "group": "success",
            "type": "Array",
            "optional": false,
            "field": "collection.comments",
            "description": "<p>A list of comments of the article</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "collection.lastEvent",
            "description": "<p>Last Livefyre event handled by the application</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "collection.totalPages",
            "description": "<p>Total number of pages of comments</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "collection.nextPage",
            "description": "<p>Next page of comments (pagination)</p>"
          },
          {
            "group": "success",
            "type": "Object",
            "optional": false,
            "field": "userDetails",
            "description": "<p>Data about the user</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "userDetails.token",
            "description": "<p>Auth token of Livefyre. See <a href=\"http://answers.livefyre.com/developers/getting-started/tokens/auth/\">Livefyre documentation</a></p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "userDetails.expires",
            "description": "<p>Timestamp of when the token expires.</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "userDetails.displayName",
            "description": "<p>The user's pseudonym (nickname).</p>"
          },
          {
            "group": "success",
            "type": "Object",
            "optional": false,
            "field": "userDetails.settings",
            "description": "<p>The user's email notification settings.</p>"
          },
          {
            "group": "success",
            "type": "Object",
            "optional": false,
            "field": "userDetails.moderationRights",
            "description": "<p>Moderation rights of the user</p>"
          },
          {
            "group": "success",
            "type": "Boolean",
            "optional": false,
            "field": "userDetails.moderator",
            "description": "<p>Whether the user is moderator or not.</p>"
          }
        ],
        "unclassified": [
          {
            "group": "unclassified",
            "type": "Object",
            "optional": false,
            "field": "collection",
            "description": "<p>Data about the article</p>"
          },
          {
            "group": "unclassified",
            "type": "Boolean",
            "optional": false,
            "field": "collection.unclassifiedArticle",
            "description": "<p>Relates to the legacy mapping of articles to different sites based on primary section/URL. If the URL was not mapped by the legacy mapping logic, flag it.</p>"
          }
        ],
        "no pseudonym": [
          {
            "group": "no pseudonym",
            "type": "Object",
            "optional": false,
            "field": "userDetails",
            "description": "<p>Data about the user</p>"
          },
          {
            "group": "no pseudonym",
            "type": "Boolean",
            "optional": false,
            "field": "userDetails.pseudonym",
            "description": "<p>Pseudonym false is the flag that the user does not have a pseudonym yet.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Full response",
          "content": " HTTP/1.1 200 OK\n  collection: {\n  \tcollectionId: \"151521626\",\n   \t\tcomments: [\n     \t\t{\n       \t\t\tparentId: \"\",\n          \t\tauthor: {\n            \t\t\tid: \"5234343@ft.fyre.co\",\n               \t\tdisplayName: \"pseudonym\",\n                 \ttags: [ ],\n                  \ttype: 1\n                 },\n                 content: \"<p>test</p>\",\n                 timestamp: 1453813771,\n                 commentId: \"634534523\",\n                 visibility: 1\n              }\n         ],\n         lastEvent: 1453813771483100,\n         totalPages: 1,\n         nextPage: null\n     },\n     userDetails: {\n     \ttoken: \"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJmdC5meXJlLmNvIiwidXNlcl9pZCI6IjkwMjY1MDIiLCJkaXNwbGF5X25hbWUiOiJyb2xpIG1haW4iLCJleHBpcmVzIjoxNDY4MzMyMjU2Ljk1NSwiaWF0IjoxNDUzNzk2Mjc5fQ.LIxHm5cpDgVLVteoZaK9ZNn7yjMGPRt8RjACc2vlSVk\",\n      \texpires: 1468332257705,\n       \tdisplayName: \"roli main\",\n        \tmoderationRights: {\n         \tcollections: [ ],\n          \tnetworks: [\n         \t \t\"ft-2.fyre.co\"\n            \t],\n             sites: [\n         \t   \"3634533\"\n             ]\n         },\n         settings: {\n     \t   \temailcomments: \"never\",\n      \t  \temaillikes: \"never\",\n       \t \temailreplies: \"never\",\n        \t\temailautofollow: \"off\"\n          },\n          moderator: true\n     }\n}",
          "type": "json"
        },
        {
          "title": "Unclassified article",
          "content": "HTTP/1.1 200 OK\n {\n    \"collection\": {\n        \"unclassified\": true\n    },\n    \"userDetails\": {\n        ....\n    }\n }",
          "type": "json"
        },
        {
          "title": "No pseudonym",
          "content": "HTTP/1.1 200 OK\n {\n    \"collection\": {\n        ...\n    },\n    \"userDetails\": {\n        \"pseudonym\": false\n    }\n }",
          "type": "json"
        }
      ]
    },
    "filename": "app/routes/v1.js",
    "groupTitle": "v1"
  },
  {
    "type": "get / post",
    "url": "v1/postComment",
    "title": "postComment",
    "version": "1.1.0",
    "group": "v1",
    "name": "postComment",
    "description": "<p>Endpoint to post a comment.</p>",
    "parameter": {
      "fields": {
        "Parameter": [
          {
            "group": "Parameter",
            "type": "Number",
            "optional": false,
            "field": "collectionId",
            "description": "<p>Required. ID of the collection.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "commentBody",
            "description": "<p>Required. Body of the comment.</p>"
          },
          {
            "group": "Parameter",
            "type": "String",
            "optional": false,
            "field": "sessionId",
            "description": "<p>Session ID of the user. Optional, but if not present, FTSession cookie is used.</p>"
          }
        ]
      }
    },
    "success": {
      "fields": {
        "success": [
          {
            "group": "success",
            "type": "Boolean",
            "optional": false,
            "field": "success",
            "description": "<p>Whether the response is a success or not.</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "status",
            "description": "<p>Textual representation of the status of the response</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "code",
            "description": "<p>HTTP status code of the response</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "bodyHtml",
            "description": "<p>The content of the comment posted.</p>"
          },
          {
            "group": "success",
            "type": "String",
            "optional": false,
            "field": "commentId",
            "description": "<p>ID of the comment.</p>"
          },
          {
            "group": "success",
            "type": "Number",
            "optional": false,
            "field": "createdAt",
            "description": "<p>Timestamp of the creation date of the comment</p>"
          },
          {
            "group": "success",
            "type": "Boolean",
            "optional": false,
            "field": "invalidSession",
            "description": "<p>Whether the user's session is valid or not.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Full response",
          "content": "HTTP/1.1 200 OK\n {\n \t\"bodyHtml\": \"<p>101</p>\",\n \t\"commentId\": \"450210605\",\n   \t\"createdAt\": 1453884494,\n   \t\"status\": \"ok\",\n   \t\"code\": 200,\n    \"success\": true,\n    \"invalidSession\": false\n }",
          "type": "json"
        }
      ]
    },
    "error": {
      "fields": {
        "unclassified": [
          {
            "group": "unclassified",
            "type": "Boolean",
            "optional": false,
            "field": "success",
            "description": "<p>Whether the response is a success or not.</p>"
          },
          {
            "group": "unclassified",
            "type": "String",
            "optional": false,
            "field": "status",
            "description": "<p>Textual representation of the status of the response</p>"
          },
          {
            "group": "unclassified",
            "type": "Number",
            "optional": false,
            "field": "code",
            "description": "<p>HTTP status code of the response</p>"
          },
          {
            "group": "unclassified",
            "type": "String",
            "optional": false,
            "field": "errorMessage",
            "description": "<p>The error message</p>"
          },
          {
            "group": "unclassified",
            "type": "Boolean",
            "optional": false,
            "field": "invalidSession",
            "description": "<p>Whether the user's session is valid or not.</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Unclassified article",
          "content": "HTTP/1.1 401 Not authorized\n {\n \t\"success\": false,\n \t\"status\": \"error\",\n \t\"code\": 401,\n \t\"errorMessage\": \"User session is not valid.\",\n \t\"invalidSession\": true\n }",
          "type": "json"
        }
      ]
    },
    "filename": "app/routes/v1.js",
    "groupTitle": "v1"
  }
] });
