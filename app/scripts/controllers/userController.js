
'use strict';

//
// userController.js
// Handle user entry points
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var UserController = {};
module.exports = UserController;

var config = require('../config/config');

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});
var Recaptcha = require('recaptcha-v2').Recaptcha;

// we use recaptcha to deter user creation bots
var verifyRecaptcha = function(recaptchaData) {

    var recaptcha = new Recaptcha(
        config.recaptchaPublic,
        config.recaptchaSecret,
        recaptchaData
    );

    return new Promise(function(resolve, reject) {
        recaptcha.verify(function(success, errorCode) {
            if (!success) {
	        reject(errorCode);
            } else {
	        resolve();
	    }
        });
    });
};

// create new user account
// 1. verify recaptcha
// 2. verify not duplicate username
// 3. create the tapis/agave user account
// 4. verify we can get token with username/password
// 5. create user profile metadata record
// 6. create user verification metadata record
// 7. send user verification email
UserController.createUser = async function(request, response) {
    config.injectError(request.body.inject_error);

    // The API middleware verifies these are present
    var user = new User(request.body);
    var recaptchaData = {
	remoteip:  request.body['remoteip'],
	response: request.body['g-recaptcha-response'],
	secret: config.recaptchaSecret,
    };
    var msg = null;

    console.log('VDJ-API INFO: UserController.createUser - begin for ' + JSON.stringify(user.getSanitizedAttributes()));

    // check username meets requirements

    // check password meets requirements

    // BEGIN RECAPTCHA CHECK
    if (config.allowRecaptchaSkip && (recaptchaData['response'] == 'skip_recaptcha')) {
        console.log('VDJ-API INFO: UserController.createUser - WARNING - Recaptcha check is being skipped.');
    } else {
	await verifyRecaptcha(recaptchaData)
	    .catch(function(errorCode) {
                msg = 'VDJ-API ERROR: UserController.createUser - recaptcha error for '
		    + JSON.stringify(user.getSanitizedAttributes())
		    + ' and error code is: ' + errorCode;
            });

        if (msg) {
            console.error(msg);
            return apiResponseController.sendError(msg, 400, response);
        }
    }
    // END RECAPTCHA CHECK

    // check for duplicate username
    var isDuplicate = false;
    if (config.useTestAccount && user.username == config.testAccountUsername) {
	// skip for test account
	console.log('VDJ-API INFO: UserController.createUser - WARNING - Duplicate username check is being bypassed.');
    } else {
        isDuplicate = await agaveIO.isDuplicateUsername(user.username)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: UserController.createUser - agave duplicate account check got error for ' + JSON.stringify(user.getSanitizedAttributes())
                    + ', error: ' + error;
            });
    }
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (isDuplicate === true) {
        console.log('VDJ-API INFO: UserController.createUser - duplicate username for ' + JSON.stringify(user.getSanitizedAttributes()));
        msg = 'duplicate username';
        return apiResponseController.sendError(msg, 400, response);
    }
    console.log('VDJ-API INFO: UserController.createUser - agave duplicate account check successful for '
                + JSON.stringify(user.getSanitizedAttributes()));

    // create agave user
    if (config.useTestAccount && user.username == config.testAccountUsername) {
	// skip for test account
	console.log('VDJ-API INFO: UserController.createUser - WARNING - Agave account creation is being bypassed.');
    } else {
        await agaveIO.createUser(user.getCreateUserAttributes())
            .catch(function(error) {
		msg = 'VDJ-API ERROR: UserController.createUser - agave account creation failed for ' + JSON.stringify(user.getSanitizedAttributes())
                    + ', error: ' + error;
            });
    }
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log('VDJ-API INFO: UserController.createUser - agave account creation successful for ' + JSON.stringify(user.getSanitizedAttributes()));

    // get token for user
    var userToken = await agaveIO.getToken(user)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.createUser - token fetch failed for ' + JSON.stringify(user.getSanitizedAttributes())
                + ', error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log('VDJ-API INFO: UserController.createUser - token fetch successful for ' + JSON.stringify(user.getSanitizedAttributes()));

    // TODO: should we check if user profile exists? It should not for a new user, presumably just for test accounts

    // create user profile
    var userProfile = await agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.createUser - create user profile failed for ' + JSON.stringify(user.getSanitizedAttributes())
                + ', error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log('VDJ-API INFO: UserController.createUser - create user profile (' + userProfile.uuid
                + ') successful for ' + JSON.stringify(user.getSanitizedAttributes()));

    // create user verification
    var userVerificationMetadata = await agaveIO.createUserVerificationMetadata(user.username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.createUser - verification metadata failed for ' + JSON.stringify(user.getSanitizedAttributes())
                + ', error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log('VDJ-API INFO: UserController.createUser - verification metadata (' + userVerificationMetadata.uuid
                + ') successful for ' + JSON.stringify(user.getSanitizedAttributes()));

    // send verification email
    emailIO.sendWelcomeEmail(user.email, user.username, userVerificationMetadata.uuid);
    console.log('VDJ-API INFO: UserController.createUser - send email successful for ' + JSON.stringify(user.getSanitizedAttributes()));

    msg = 'VDJ-API INFO: UserController.createUser - acount creation complete for ' + JSON.stringify(user.getSanitizedAttributes());
    console.log(msg);
    webhookIO.postToSlack(msg);
    return apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
};

// check if username is already being used
UserController.duplicateUsername = async function(request, response) {
    var username = request.params.username;
    var msg = null;

    if (config.debug) console.log('VDJ-API INFO: UserController.duplicateUsername - checking username ' + username);

    // check for duplicate username
    var isDuplicate = await agaveIO.isDuplicateUsername(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.createUser - agave duplicate account check got error for ' + username
                + ', error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (isDuplicate === true)
        return apiResponseController.sendSuccess('duplicate', response);
    else
        return apiResponseController.sendSuccess('not duplicate', response);
};


// Change user password
// Only for authenticated user, plus have to send original password
UserController.changePassword = function(request, response) {
/*
    var username = request.user.username;
    var password = request.body.password;
    var newPassword = request.body.new_password;

    console.log('VDJ-API INFO: UserController.changePassword - begin for ' + username);

    // 0.  Verify old password
    // 1.  Get user profile
    // 2.  Reset password
    // 3.  Response
    // 3a. Success
    // 3b. Fail
    var auth = {
        username: username,
        password: password,
    };

    agaveIO.getToken(auth) // 0.
        .then(function() {
            console.log('VDJ-API INFO: UserController.changePassword - token verify success for ' + username);

            // current password verified
            return agaveIO.getUserProfile(username); // 1.
        })
        .then(function(profile) {
            console.log('VDJ-API INFO: UserController.changePassword - profile fetch success for ' + username);

            if (profile && profile[0] && profile[0].value && profile[0].value.email) {
                return agaveIO.updateUserPassword({ // 2.
                    'username': username,
                    'email': profile[0].value.email,
                    'password': newPassword,
                });
            }
            else {
                return Q.reject(
                    new Error('UserController.changePassword - error - password change fail for ' + username + '. User profile not found.')
                );
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: UserController.changePassword - change password complete for ' + username);
            apiResponseController.sendSuccess('Password changed successfully.', response); // 3a.
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: UserController.changePassword - error - username ' + username + ', error ' + error);
            apiResponseController.sendError('Invalid authorization', 401, response); // 3b.
        })
        ;
*/

    apiResponseController.sendError("Not implemented", 500, response);
};

// verify the user given the verification code sent by email
UserController.verifyUser = async function(request, response) {
    var verificationId = request.params.verification_id;
    var msg = null;

    console.log('VDJ-API INFO: UserController.verifyUser - begin for ' + verificationId);

    var userVerificationMetadata = await agaveIO.getMetadata(verificationId)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.verifyUser - error - metadataId ' + verificationId + ', error ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    if (userVerificationMetadata.name != 'userVerification') {
        msg = 'VDJ-API ERROR: UserController.verifyUser - error - metadata is not a userVerification item: ' + verificationId;
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    if (userVerificationMetadata && verificationId === userVerificationMetadata.uuid) {
        var username = userVerificationMetadata.value.username;

	if (!username) {
            msg = 'VDJ-API ERROR: UserController.verifyUser - error - metadata missing username: ' + verificationId;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 400, response);
	}

        await agaveIO.verifyUser(username, verificationId)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: UserController.verifyUser - error - metadataId ' + verificationId + ', error ' + error;
            });
        if (msg) {
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }
    }
    else {
        msg = 'UserController.verifyUser - error - verification metadata failed comparison for ' + verificationId;
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    console.log('VDJ-API INFO: UserController.verifyUser - verification complete for ' + verificationId);
    apiResponseController.sendSuccess('', response);
};

// resend verification email for given username
UserController.resendVerificationEmail = async function(request, response) {
    var username = request.params.username;
    var msg = null;

    console.log('VDJ-API INFO: UserController.resendVerificationEmail - begin for ' + username);
    console.log('VDJ-API INFO: UserController.resendVerificationEmail - get verification metadata for ' + username);

    var userVerificationMetadata = await agaveIO.getUserVerificationMetadata(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: Non-existent verification for username: ' + username;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendErrorWithCode(msg, 'invalid username', 400, response);
    }

    if (!userVerificationMetadata || userVerificationMetadata.length != 1) {
        msg = 'VDJ-API ERROR: UserController.resendVerificationEmail - error - invalid verification metadata for ' + username;
        console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    if (userVerificationMetadata[0].value.isVerified === true) {
        msg = 'VDJ-API INFO: UserController.resendVerificationEmail - user is already verified';
        console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    console.log('VDJ-API INFO: UserController.resendVerificationEmail - get profile for ' + username);
    var verificationId = userVerificationMetadata[0].uuid;
    var profileMetadata = await agaveIO.getUserProfile(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.resendVerificationEmail - error - user profile could not be found for ' + username;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    console.log('VDJ-API INFO: UserController.resendVerificationEmail - send verification email for ' + username);
    if (profileMetadata && profileMetadata[0] && profileMetadata[0].value && profileMetadata[0].value.email) {
        await emailIO.sendWelcomeEmail(profileMetadata[0].value.email, username, verificationId);
    } else {
        msg = 'VDJ-API ERROR: UserController.resendVerificationEmail - error - invalid user profile for ' + username;
        console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    console.log('VDJ-API INFO: UserController.resendVerificationEmail - complete for ' + username);
    apiResponseController.sendSuccess('', response);
};

// 1.  Get confirm username, email address from user profile
// 2.  Generate random key by posting to metadata
// 3.  Send email
// 4.  Send response success
// TODO: this should be protected by a recaptcha
UserController.createResetPasswordRequest = async function(request, response) {
try {
    var username = request.body.username;
    var msg = null;

    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - begin for user ' + username);
    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - getUserProfile for user ' + username);

    var userProfile = await agaveIO.getUserProfile(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: PasswordResetController.createResetPasswordRequest - error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendErrorWithCode(msg, 'invalid username', 400, response);
    }

    if (userProfile && userProfile[0]) userProfile = userProfile[0];
    else {
        msg = 'VDJ-API ERROR: PasswordResetController.createResetPasswordRequest - error - username unknown for ' + username;
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendErrorWithCode(msg, 'invalid username', 400, response);
    }

    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - createPasswordResetMetadata for user ' + username);
    var passwordReset = await agaveIO.createPasswordResetMetadata(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: PasswordResetController.createResetPasswordRequest - error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - sendPasswordResetEmail for user ' + username);
    await emailIO.sendPasswordResetEmail(userProfile.value.email, passwordReset.uuid)

    apiResponseController.sendSuccess('Password reset email sent.', response);
} catch (e) { console.error(e); }
/*
    var username = request.body.username;

    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - begin for user ' + username);

    var userProfile;

    // 1.  Get confirm username, email address from user profile
    // 2.  Generate random key by posting to metadata
    // 3.  Send email
    // 4a. Send response success
    // 4b. Send response error
    agaveIO.getUserProfile(username) // 1.
        .then(function(profile) {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - getUserProfile for user ' + username);

            if (profile[0]) {
                userProfile = profile[0];
                return agaveIO.createPasswordResetMetadata(username); // 2.
            }
            else {
                return Q.reject(new Error('PasswordResetController.createResetPasswordRequest - error - username unknown for ' + username));
            }
        })
        .then(function(passwordReset) {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - createPasswordResetMetadata for user ' + username);

            return emailIO.sendPasswordResetEmail(userProfile.value.email, passwordReset.uuid); // 3.
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - sendPasswordResetEmail for user ' + username);

            apiResponseController.sendSuccess('Password reset email sent.', response); // 4a.
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: PasswordResetController.createResetPasswordRequest - error - username ' + username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response); // 4b.
        })
        ;
*/

};

// 1.  Get password reset metadata for given uuid
// 2.  Verify password reset uuid and matching username
// 3.  Get user profile
// 4.  Update user with new password
// 5.  Delete password reset metadata
// 5a. Report error if delete fails
// 6.  Response
UserController.processResetPasswordRequest = async function(request, response) {
try {
    var username = request.body.username;
    var uuid = request.body.reset_code;
    var newPassword = request.body.new_password;
    var msg = null;

    console.log('VDJ-API INFO: UserController.processResetPasswordRequest - begin for user ' + username);
    console.log('VDJ-API INFO: UserController.processResetPasswordRequest - getPasswordResetMetadata for user ' + username);

    var passwordResetMetadata = await agaveIO.getPasswordResetMetadata(uuid)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest - error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (passwordResetMetadata.length == 0) {
	msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest, Invalid metadata id: ' + uuid;
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    if (username != passwordResetMetadata[0].value.username) {
	msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest, reset metadata uuid does not match.';
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    console.log('VDJ-API INFO: UserController.processResetPasswordRequest - getUserProfile for user ' + username);
    var passwordReset = passwordResetMetadata[0];
    var profile = await agaveIO.getUserProfile(username)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest - error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - updateUserPassword for user ' + username);
    await agaveIO.updateUserPassword({'username': username, 'email': profile[0].value.email, 'password': newPassword})
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest - error: ' + error;
        });
    if (msg) {
	console.error(msg);
	webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    //    while metadata is deleted, service returns 500 error;
    //    don't let this short-circuit the process
    console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - deleteMetadata for user ' + username);
    await agaveIO.deleteMetadata(ServiceAccount.accessToken(), passwordReset.uuid)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: UserController.processResetPasswordRequest - error: ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
        });

    apiResponseController.sendSuccess('Password reset successfully.', response); // 6a.
} catch (e) { console.error(e); }


/*
    var username = request.body.username;
    var uuid = request.body.reset_code;
    var newPassword = request.body.new_password;

    console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - begin for user ' + username);

    var passwordReset;

    // 1.  Get password reset metadata for given uuid
    // 2.  Verify password reset uuid and matching username
    // 3.  Get user profile
    // 4.  Update user with new password
    // 5.  Delete password reset metadata
    // 5a. Report error if delete fails
    // 6.  Response
    // 6a. Success
    // 6b. Error
    agaveIO.getPasswordResetMetadata(uuid) // 1.
        .then(function(passwordResetMetadata) {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - getPasswordResetMetadata for user ' + username);

	    //console.log(passwordResetMetadata);
	    //console.log(passwordResetMetadata[0]);
	    if (passwordResetMetadata.length == 0)
		return Q.reject(new Error('Invalid metadata id: ' + uuid));

            if (username === passwordResetMetadata[0].value.username) { // 2.
                passwordReset = passwordResetMetadata[0];
                return agaveIO.getUserProfile(username); // 3.
            }
            else {
                return Q.reject(new Error('PasswordResetController.processResetPasswordRequest - error - reset metadata uuid does not match.'));
            }
        })
        .then(function(profile) {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - getUserProfile for user ' + username);

            return agaveIO.updateUserPassword({
                'username': username,
                'email': profile[0].value.email,
                'password': newPassword
            }); // 4.
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - updateUserPassword for user ' + username);

            //
            //    while metadata is deleted, service returns 500 error;
            //    don't let this short-circuit the process
            //
            agaveIO.deleteMetadata(ServiceAccount.accessToken(), passwordReset.uuid) // 5.
                .fail(function(error) { // 5a.
                    console.error(error.message, error);
                });
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - deleteMetadata for user ' + username);

            apiResponseController.sendSuccess('Password reset successfully.', response); // 6a.
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: PasswordResetController.processResetPasswordRequest - error - username ' + username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response); // 6b.
        })
        ;
*/

};
