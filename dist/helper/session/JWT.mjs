import JWT from 'jsonwebtoken';
import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
import { Central } from '@lionrockjs/central';
function randomUUID() {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.randomUUID)
        return cryptoApi.randomUUID();
    if (!cryptoApi?.getRandomValues)
        throw new Error('Session ID generation requires crypto.getRandomValues');
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
function getSessionSecret(options) {
    const request = options?.state?.get?.('request');
    const requestSecret = request?.env?.SESSION_SECRET;
    const processSecret = Central.runtime?.process?.()?.env?.SESSION_SECRET;
    const configSecret = Central.config?.session?.secret;
    const secret = requestSecret ?? processSecret ?? configSecret;
    if (typeof secret === 'string' && secret.length > 0)
        return secret;
    if (secret && typeof secret !== 'string')
        return secret;
    throw new Error('SESSION_SECRET is required for JWT sessions.');
}
export default class SessionJWT extends AbstractAdapterSession {
    static async read(cookies, options) {
        const config = { ...Central.config.session, ...options };
        if (!cookies[config.name])
            return this.create();
        const decoded = JWT.verify(cookies[config.name], getSessionSecret(options));
        if (typeof decoded !== 'object' || !decoded)
            return this.create();
        return {
            ...this.create(),
            ...decoded,
        };
    }
    static async write(session, cookies, options) {
        const config = { ...Central.config.session, ...options };
        if (!session.id)
            session.id = randomUUID();
        const expire = config.expires ?? 60 * 60 * 2;
        const data = Object.assign({}, session, { exp: Math.floor(Date.now() / 1000) + expire });
        const jwt = JWT.sign(data, getSessionSecret(options));
        cookies.push({
            name: config.name,
            value: jwt,
            options: Central.config.cookie.options,
        });
    }
}
