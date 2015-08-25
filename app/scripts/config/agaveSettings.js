module.exports = {

    // WSO2 Auth Settings
    clientKey:    process.env.WSO2_CLIENT_KEY,
    clientSecret: process.env.WSO2_CLIENT_SECRET,
    hostname:     process.env.WSO2_HOST,

    // VDJ Service Account User
    serviceAccountKey: process.env.VDJ_SERVICE_ACCOUNT,
    serviceAccountSecret: process.env.VDJ_SERVICE_ACCOUNT_SECRET,
    serviceAccountToken: process.env.VDJ_SERVICE_ACCOUNT_TOKEN,

    // VDJ Backbone Location
    vdjBackbone: process.env.VDJ_BACKBONE_HOST,

    // Agave Misc.
    storageSystem: process.env.AGAVE_STORAGE_SYSTEM,

    // Email
    fromAddress: process.env.EMAIL_ADDRESS,

    // Debug
    debugConsole: process.env.DEBUG_CONSOLE,
};