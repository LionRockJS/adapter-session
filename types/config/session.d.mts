declare const _default: {
    algorithm: string;
    saveUninitialized: boolean;
    resave: boolean;
    name: string;
    expires: number;
    accessToken: {
        expires: number;
    };
    refreshToken: {
        enabled: boolean;
        expires: number;
        rotate: boolean;
    };
    jti: {
        enabled: boolean;
        tokenUse: string;
        require: boolean;
    };
    authorizationHeader: boolean;
    clockTolerance: number;
    minimumSecretLength: number;
    maxTokenLength: number;
};
export default _default;
