
'use strict';

//
// tokenController.js
// User authentication and token refresh
//
// VDJServer Analysis Portal
// VDJ Web API service
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

var TokenController = {};
module.exports = TokenController;

var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

// Processing
var webhookIO = require('../vendor/webhookIO');

// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.getToken - begin for ' + request.body.username);

    return tapisIO.getUserVerificationMetadata(request.body.username)
        .then(function(userVerificationMetadata) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata for ' + request.body.username);
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                return tapisIO.getToken(request.body);
            }
            else {
                return Promise.reject(new Error('TokenController.getToken - error - unable to verify account for ' + request.body.username));
            }
        })
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata successful for ' + request.body.username);
            webhookIO.postToSlack('VDJ-API INFO: TokenController.getToken - successful for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.getToken - error - username ' + request.body.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.refreshToken - begin for ' + request.body.username);

    return tapisIO.refreshToken(request.body)
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.refreshToken - complete for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.refreshToken - error - username ' + request.body.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};
