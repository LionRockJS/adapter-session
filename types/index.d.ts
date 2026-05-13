import SessionJWT from './helper/session/JWT.mjs';
declare const _default: {
    configs: {
        session: {
            algorithm: string;
            saveUninitialized: boolean;
            resave: boolean;
            name: string;
            expires: number;
        };
    };
};
export default _default;
export { SessionJWT };
