
'use strict';

// Settings
var agaveSettings = require('../../config/agaveSettings');

// AgaveToken
var AgaveToken = require('../../models/agaveToken');

var agaveIO  = {};
module.exports = agaveIO;


// A utility method to help map token responses onto the token object in order to help stay organized and consistent
agaveIO.parseTokenResponse = function(responseObject) {

    var agaveToken = new AgaveToken();

    agaveToken.token_type    = responseObject.token_type;
    agaveToken.expires_in    = responseObject.expires_in;
    agaveToken.refresh_token = responseObject.refresh_token;
    agaveToken.access_token  = responseObject.access_token;

    return agaveToken;
};

var IsJSON = function(input) {
    try {
        JSON.parse(input);
    }
    catch (error) {
        return false;
    }

    return true;
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.getToken = function(auth, callback) {

    var postData = 'grant_type=password&scope=PRODUCTION&username=' + auth.username + '&password=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                console.log("getToken error resp is not json");
                callback('error');
            }

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                console.log("getToken error - resp is: " + JSON.stringify(responseObject));
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};


// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth, callback) {

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                callback('error');
            }

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

// Deletes a token
agaveIO.deleteToken = function(auth, callback) {

    var postData = 'token=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/revoke',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };


    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                callback('error');
            }

            if (responseObject && responseObject.status && responseObject.status === 'success')
            {
                callback(null, agaveToken);
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(error) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.createUser = function(user, serviceAccount, callback) {

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;


    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/subscribers/v1/',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                callback('error');
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                callback(null, 'success');
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

agaveIO.createUserProfile = function(user, userAccessToken, callback) {

    var postData = {
        name: 'profile',
        value: user
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + userAccessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                callback('error');
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                callback(null, 'success');
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

agaveIO.createProject = function(project, vdjauthAccessToken, callback) {

    var postData = {
        name: 'project',
        value: project
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + vdjauthAccessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                callback('error');
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                callback(null, 'success');
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};
