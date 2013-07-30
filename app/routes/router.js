
// App
var express = require ('express');

// Controllers
var tokenController        = require('../controllers/tokenController');
var internalUserController = require('../controllers/internalUserController');
var apiResponseController  = require('../controllers/apiResponseController');

// Models
var TokenAuth = require('../models/tokenAuth');

module.exports = function(app) {


    // Verify user credentials via Agave
    var auth = express.basicAuth(function(username, password, callback) {

        console.log("app basic auth. username is: " + username);

        // TODO add lookup auth via storage (Agave?)
       
        var tokenAuth = new TokenAuth.schema();
        tokenAuth.internalUsername = username;
        tokenAuth.password         = password;

        callback(null, tokenAuth);
    });


    // Request an Agave internalUsername token
    app.post('/token', auth, tokenController.getInternalUserToken);

    // Refresh an Agave internalUsername token
    app.put('/token/*', auth, tokenController.refreshInternalUserToken);


    // Create a new account
    app.post('/user', internalUserController.createInternalUser);


    // Errors
    app.get(   '*', apiResponseController.send404);
    app.post(  '*', apiResponseController.send404);
    app.put(   '*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);



    // TEMP: misc. code that will help with creating a new account
    /*
    var newAccount = new accountCollection();

    newAccount.username  = request.param('username');
    newAccount.password  = request.param('password');
    newAccount.email     = request.param('email');

    AM.addNewAccount(newAccount, function(error) {

        if (error) {
            // Bad Request
            response.send(error, 400);
        }
        else {
            // Ok
            response.send('ok', 200);
        }

    });

    */
};
