
// Settings
var agaveSettings = require('../../app/config/agave-settings');

// Fixtures
var agaveTokenFixture = require('../fixtures/agaveTokenFixture');


var AgaveMocks = {}
module.exports = AgaveMocks;


// Tokens - internal users
AgaveMocks.internalUserTokenFetch = function(nock) {
    nock('https://' + agaveSettings.host)
        .post(agaveSettings.authEndpoint, {"internalUsername" : agaveSettings.testInternalUser, "lifetime" : 10800})
        .reply(200, agaveTokenFixture.internalUserResponse)
    ;

    return nock;
};

AgaveMocks.internalUserTokenFetchError = function(nock) {
    nock('https://' + agaveSettings.host)
        .post(agaveSettings.authEndpoint)
        .reply(401)
    ;

    return nock;
};


// Tokens - vdj
AgaveMocks.vdjTokenFetch = function(nock) {
    nock('https://' + agaveSettings.host)
        .post(agaveSettings.authEndpoint, "lifetime=" + 10800)
        .reply(200, agaveTokenFixture.vdjResponse)
    ;

    return nock;
};

AgaveMocks.vdjTokenRefresh = function(nock) {
    nock('https://' + agaveSettings.host)
        .put(agaveSettings.authEndpoint + 'tokens' + '/' + agaveTokenFixture.vdjToken)
        .reply(200, agaveTokenFixture.vdjResponse)
    ;

    return nock;
};



// Create Internal User
AgaveMocks.createInternalUser = function(nock) {
    nock('https://' + agaveSettings.host)
        .post(agaveSettings.createInternalUserEndpoint, {"username": agaveSettings.testInternalUser, "email": agaveSettings.testInternalUserEmail})
        .reply(200, agaveTokenFixture.vdjResponse)
    ;

    return nock;
};

AgaveMocks.createInternalUserError = function(nock, badInternalUsername) {
    nock('https://' + agaveSettings.host)
        .post(agaveSettings.createInternalUserEndpoint, {"username": badInternalUsername })
        .reply(401)
    ;

    return nock;
};
