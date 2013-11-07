
var testData = require('../datasource/testData');

var AgaveTokenFixture = {};

module.exports = AgaveTokenFixture;

AgaveTokenFixture.vdjToken          = "123456ABC"
AgaveTokenFixture.internalUserToken = "BlitherinBarnacles111"

AgaveTokenFixture.vdjResponse = {
    status: "success",
    message: "",
    version: "2.2.0-r8265",
    result: {
        token:              AgaveTokenFixture.vdjToken,
        username:           testData.authenticatedUser,
        internalUsername:   null,
        creator:            testData.authenticatedUser,
        remainingUses:      "unlimited",
        created:            "2013-08-02T21:59:24+00:00",
        expires:            "2013-08-02T23:59:24+00:00",
        renewed:            "2013-08-02T21:59:24+00:00",
        _link: {
            self: {
                href: "https://iplant-dev.tacc.utexas.edu/v2/auth/tokens/123456ABC"
            },
            profile: {
                href: "https://iplant-dev.tacc.utexas.edu/v2/profiles/" + testData.authenticatedUser
            }
        }
    }
};

AgaveTokenFixture.internalUserResponse =   {
    status: "success",
    message: "",
    version: "2.2.0-r8265",
    result: {
        token:              AgaveTokenFixture.internalUserToken,
        username:           testData.authenticatedUser,
        internalUsername:   testData.internalUser,
        creator:            testData.authenticatedUser,
        remainingUses:      "unlimited",
        created:            "2013-08-02T21:59:24+00:00",
        expires:            "2013-08-02T23:59:24+00:00",
        renewed:            "2013-08-02T21:59:24+00:00",
        _link: {
            self: {
                href: "https://iplant-dev.tacc.utexas.edu/v2/auth/tokens/123456ABC"
            },
            profile: {
                href: "https://iplant-dev.tacc.utexas.edu/v2/profiles/" + testData.authenticatedUser
            }
        }
    }
};