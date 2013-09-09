
// Processing
var agaveIO       = require('../app/scripts/vendor/agave/agaveIO');
var agaveSettings = require('../app/scripts/config/agave-settings');

// Controllers
var tokenController = require('../app/scripts/controllers/tokenController');

// Models
var TokenAuth    = require('../app/scripts/models/tokenAuth');
var InternalUser = require('../app/scripts/models/internalUser');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var testData   = require('./datasource/testData');
var agaveMocks = require('./mocks/agaveMocks');


describe("agaveIO token functions", function() {

    before(function(done) {

        done();
    });

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });


    it("should be able to calculate post length for token request for internal username 'testMartyMcFly'", function() {

        var data = agaveIO.tokenRequestSettings(testData.internalUser);
        data.headers['Content-Length'].should.equal(14);

    });

    it("should be able to retrieve a token from Agave for internal username '" + testData.internalUser + "'", function(done) {

        agaveMocks.internalUserTokenFetch(nock);

        var tokenAuth = new TokenAuth();
        tokenAuth.internalUsername = testData.internalUser;

        agaveIO.getInternalUserToken(tokenAuth, function(error, tokenAuth) {
            should.not.exist(error);
            tokenAuth.token.should.not.equal("");
            done();
        });

    });

    it("should return an error message when retrieving a token from Agave for bad internal username 'testBiffTannen'", function(done) {

        agaveMocks.internalUserTokenFetchError(nock);

        var tokenAuth = new TokenAuth();
        tokenAuth.internalUsername = "testBiffTannen";

        agaveIO.getInternalUserToken(tokenAuth, function(error, tokenAuth) {
            should.exist(error);
            done();
        });

    });

    it("should be able to retrieve a VDJ Auth token from Agave", function(done) {

        agaveMocks.vdjTokenFetch(nock);

        var tokenAuth = new TokenAuth();

        agaveIO.getNewVdjToken(tokenAuth, function(error, tokenAuth) {
            should.not.exist(error);
            tokenAuth.token.should.not.equal("");
            done();
        });

    });

    it("should be able to refresh a VDJ Auth token from Agave", function(done) {

        agaveMocks.vdjTokenFetch(nock);
        agaveMocks.vdjTokenRefresh(nock);

        var tokenAuth = new TokenAuth();

        agaveIO.getNewVdjToken(tokenAuth, function(error, newTokenAuth) {

            agaveIO.refreshToken(newTokenAuth, function(error, refreshedTokenAuth) {
                should.not.exist(error);
                refreshedTokenAuth.token.should.not.equal("");
                refreshedTokenAuth.token.should.equal(newTokenAuth.token);
                done();
            });

        });

    });


});

describe("agaveIO create internal user functions", function() {


    it("should be able to calculate post length for account creation for 'testMartyMcfly'", function() {

        var postData = {"username":"testMartyMcfly", "password":"1985", "email":"testMartyMcfly@delorean.com"};

        var returnData = agaveIO.createInternalUserRequestSettings(JSON.stringify(postData));

        returnData.headers['Content-Length'].should.equal(99);

    });

    it("should be able to create an Agave account for internal user '" + testData.internalUser + "'", function(done) {

        var internalUser = new InternalUser();
        internalUser.username = testData.internalUser;
        internalUser.password = testData.internalUserPassword;

        profile = internalUser.profile.create();
        profile.email = testData.internalUserEmail;
        internalUser.profile.push(profile);


        // Token Get / Refresh
        agaveMocks.vdjTokenFetch(nock);
        agaveMocks.vdjTokenRefresh(nock);

        // Create user request
        agaveMocks.createInternalUser(nock);

        tokenController.provideVdjToken(function(tokenError, tokenAuth) {

            agaveIO.createInternalUser(internalUser, function(error, newInternalUser) {

                should.not.exist(error);
                newInternalUser.username.should.equal(testData.internalUser);
                done();

            });

        });

    });


    it("should return an error message when creating an account that's missing the email attribute for bad internal username 'testBiffTannen'", function(done) {

        var internalUser = new InternalUser();
        internalUser.username = "testBiffTannen";
        internalUser.password = "shazam";

        profile = internalUser.profile.create();                              
        internalUser.profile.push(profile); 

        // Create user request
        agaveMocks.createInternalUserError(nock, internalUser.username);

        agaveIO.createInternalUser(internalUser, function(error, internalUser) {

            should.exist(error);
            should.not.exist(internalUser);
            done();

        });
    });

});
