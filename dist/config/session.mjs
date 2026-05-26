export default {
    algorithm: 'HS256',
    saveUninitialized: false,
    resave: false,
    name: 'lionrock-session',
    expires: 60 * 60 * 4,
    accessToken: {
        expires: 60 * 60 * 4,
    },
    refreshToken: {
        enabled: false,
        expires: 60 * 60 * 24 * 30,
        rotate: true,
    },
    jti: {
        enabled: false,
        tokenUse: 'refresh',
        require: true,
    },
    authorizationHeader: false,
    cookieDomain: undefined,
    clockTolerance: 60,
    minimumSecretLength: 32,
    maxTokenLength: 4096,
};
