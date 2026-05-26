import SessionJWT from './helper/session/JWT.mjs';
declare const _default: {
    configs: {
        session: {
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
            cookieDomain: string | undefined;
            clockTolerance: number;
            minimumSecretLength: number;
            maxTokenLength: number;
        };
    };
};
export default _default;
export { SessionJWT };
