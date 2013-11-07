
// Controllers
var tokenController       = require('./tokenController');
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Models
var InternalUser = require('../models/internalUser');


var InternalUserController = {};
module.exports = InternalUserController;


// Creates an internal user account via Agave IO and returns it to the client
InternalUserController.createInternalUser = function(request, response) {

    var genericError = "Unable to create a new Agave account for '" + request.body.internalUsername + "'.";

    if (
            request.body.internalUsername &&
            request.body.password &&
            request.body.email
       )
    {

        tokenController.provideVdjToken(function(error, tokenAuth) {

            if (!error) {

                var internalUser = new InternalUser();

                // Add mongo sub doc right now to store email
                var profile = internalUser.profile.create();
                profile.email = request.body.email;

                internalUser.profile.push(profile);


                internalUser.username = request.body.internalUsername;
                internalUser.password = request.body.password;
                internalUser.email    = request.body.email;

                agaveIO.createInternalUser(internalUser, function(agaveError, agaveSavedInternalUser) {


                    if (!agaveError) {

                        // Salt password
                        internalUser.saltAndHash();


                        internalUser.save(function(error, data) {

                            if (!error) {

                                apiResponseController.sendSuccess(agaveSavedInternalUser, response);
                            }
                            else {
                                apiResponseController.sendError(genericError, response);
                            }

                        });

                    }
                    else {
                        apiResponseController.sendError(genericError, response);
                    }

                });
            }
            else {
                apiResponseController.sendError("There was an error creating your new account. Please try again.", response);
            }
        });

    }
    else {
        apiResponseController.sendError("In order to create a new account, you must POST the following parameters JSON encoded: internalUsername, password, and email.", response);
    }

};