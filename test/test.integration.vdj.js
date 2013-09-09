
// Models
var InternalUser = require('../app/scripts/models/internalUser');

// Dependencies
var request  = require('request');
var mongoose = require('mongoose');

// Settings
var config = require('../app/scripts/config/config');
var agaveSettings = require('../app/scripts/config/agave-settings');

// Testing
var should = require('should');

// Testing Fixtures
var testData = require('./datasource/testData');

var baseUrl = 'http://localhost:8443';


describe("VDJServer Integration Tests", function() {

    var newProfileFirstName = 'Ned';
    var newProfileLastName   = 'Flanders';
    var newProfileCity      = 'Springfield';
    var newProfileState     = 'IL';
    var newProfileEmail     = 'ned@flanders.com';

    before(function(done) {

        mongoose.connect(config.mongooseDevDbString);

        // Clean up the db before we begin
        InternalUser.remove({username:testData.internalUser}, function(error) {

            var testUser = new InternalUser();

            testUser.username = testData.internalUser;
            testUser.password = testData.internalUserPassword;

            profile = testUser.profile.create();
            profile.firstName = newProfileFirstName;
            profile.lastName  = newProfileLastName;
            profile.city      = newProfileCity;
            profile.state     = newProfileState;
            profile.email     = newProfileEmail;
            testUser.profile.push(profile);

            testUser.saltAndHash();

            testUser.save(function(error, savedTestUser) {
                done();
            });

        });

    });

    after(function(done) {

        mongoose.connection.close();
        done();

    });

    it("should get a user profile from /user/profile for '" + testData.internalUser + "'", function(done) {

        var url = baseUrl + '/user/profile';

        var options = {
            url:    url,
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + testData.internalUserPassword).toString('base64')
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.firstName.should.equal(newProfileFirstName);
            body.result.lastName.should.equal(newProfileLastName);
            body.result.city.should.equal(newProfileCity);
            body.result.state.should.equal(newProfileState);
            body.result.email.should.equal(newProfileEmail);

            done();

        });

        requestObj.end();

    });

    it("should post to /user/profile and update an internal user profile for '" + testData.internalUser + "'", function(done) {

        var url = baseUrl + '/user/profile';

        var postData = {
                            "firstName": testData.internalUserFirstName,
                            "lastName":  testData.internalUserLastName,
                            "city":      testData.internalUserCity,
                            "state":     testData.internalUserState,
                            "email":     testData.internalUserEmail
                       };

        var options = {
            url:    url,
            method: 'post',
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + testData.internalUserPassword).toString('base64'),
                "Content-Type":"application/json",
                "Content-Length":JSON.stringify(postData).length
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.username.should.equal(testData.internalUser);
            body.result.profile[0].firstName.should.equal(testData.internalUserFirstName);
            body.result.profile[0].lastName.should.equal(testData.internalUserLastName);
            body.result.profile[0].city.should.equal(testData.internalUserCity);
            body.result.profile[0].state.should.equal(testData.internalUserState);
            body.result.profile[0].email.should.equal(testData.internalUserEmail);

            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });
});
