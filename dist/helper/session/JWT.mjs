import { Central } from '@lionrockjs/central';
import { AbstractAdapterSession } from "@lionrockjs/mixin-session";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const hmacAlgorithms = {
    HS256: 'SHA-256',
    HS384: 'SHA-384',
    HS512: 'SHA-512',
};
const reservedClaims = new Set(['aud', 'exp', 'iat', 'iss', 'jti', 'nbf', 'token_use']);
function normalizeJtiTokenUse(value, refreshEnabled) {
    if (value === undefined || value === null) {
        return refreshEnabled ? 'refresh' : 'access';
    }
    if (value === 'access' || value === 'refresh' || value === 'both')
        return value;
    throw new Error('JWT jti.tokenUse must be access, refresh, or both.');
}
function resolveCurrentTokenUse(tokenUse) {
    return tokenUse ?? 'access';
}
function getJtiConfig(config) {
    const refreshConfig = getRefreshTokenConfig(config);
    const jti = config.jti;
    const jtiConfig = jti === true ? {} : jti || {};
    const enabled = jti === true || !!(jti && jtiConfig.enabled !== false);
    return {
        enabled,
        tokenUse: normalizeJtiTokenUse(jtiConfig.tokenUse, refreshConfig.enabled),
        require: jtiConfig.require !== false,
        generate: jtiConfig.generate,
        persist: jtiConfig.persist,
        verify: jtiConfig.verify,
    };
}
function shouldHandleJti(config, tokenUse) {
    const jtiConfig = getJtiConfig(config);
    if (!jtiConfig.enabled)
        return false;
    const currentTokenUse = resolveCurrentTokenUse(tokenUse);
    return jtiConfig.tokenUse === 'both' || jtiConfig.tokenUse === currentTokenUse;
}
async function createJti(session, config, options, tokenUse) {
    if (!shouldHandleJti(config, tokenUse))
        return undefined;
    const jtiConfig = getJtiConfig(config);
    const currentTokenUse = resolveCurrentTokenUse(tokenUse);
    let jti = randomUUID();
    if (typeof jtiConfig.generate === 'function') {
        jti = await jtiConfig.generate({
            config,
            options,
            session,
            tokenUse: currentTokenUse,
        });
    }
    if (typeof jti !== 'string' || jti.length === 0) {
        throw new Error('JWT jti.generate must return a non-empty string.');
    }
    return jti;
}
async function persistJti(payload, session, config, options, tokenUse) {
    if (!payload.jti || !shouldHandleJti(config, tokenUse))
        return;
    const jtiConfig = getJtiConfig(config);
    if (typeof jtiConfig.persist !== 'function')
        return;
    await jtiConfig.persist({
        config,
        exp: payload.exp,
        jti: payload.jti,
        options,
        payload,
        session,
        tokenUse: resolveCurrentTokenUse(tokenUse),
    });
}
async function verifyJti(payload, config, options, tokenUse) {
    if (!shouldHandleJti(config, tokenUse))
        return;
    const jtiConfig = getJtiConfig(config);
    if (!payload.jti) {
        if (jtiConfig.require)
            throw new Error('JWT session is missing jti.');
        return;
    }
    if (typeof jtiConfig.verify !== 'function')
        return;
    const isValid = await jtiConfig.verify({
        config,
        exp: payload.exp,
        jti: payload.jti,
        options,
        payload,
        session: {
            ...SessionJWT.create(),
            ...toSessionData(payload),
        },
        tokenUse: resolveCurrentTokenUse(tokenUse),
    });
    if (isValid === false) {
        throw jwtError('JWT session jti is invalid or revoked.', 'JWT_JTI_REVOKED');
    }
}
function randomUUID() {
    if (crypto.randomUUID)
        return crypto.randomUUID();
    if (!crypto.getRandomValues)
        throw new Error('Session ID generation requires crypto.getRandomValues');
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}
function encodeBase64Url(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = '';
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte);
    });
    if (typeof btoa === 'function') {
        return btoa(binary)
            .replaceAll('+', '-')
            .replaceAll('/', '_')
            .replaceAll('=', '');
    }
    const BufferClass = globalThis.Buffer;
    if (!BufferClass)
        throw new Error('JWT base64url encoding requires btoa or Buffer.');
    return BufferClass.from(bytes)
        .toString('base64')
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');
}
function decodeBase64Url(input) {
    if (!/^[A-Za-z0-9_-]+$/.test(input))
        throw new Error('Invalid JWT base64url payload.');
    const padding = input.length % 4;
    if (padding === 1)
        throw new Error('Invalid JWT base64url length.');
    const base64 = input
        .replaceAll('-', '+')
        .replaceAll('_', '/') + '='.repeat((4 - padding) % 4);
    if (typeof atob === 'function') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    const BufferClass = globalThis.Buffer;
    if (!BufferClass)
        throw new Error('JWT base64url decoding requires atob or Buffer.');
    return new Uint8Array(BufferClass.from(base64, 'base64'));
}
function encodeJson(value) {
    return encodeBase64Url(textEncoder.encode(JSON.stringify(value)));
}
function decodeJson(value) {
    return JSON.parse(textDecoder.decode(decodeBase64Url(value)));
}
function getConfig(options) {
    return {
        ...Central.config.session,
        ...options,
    };
}
function getAlgorithm(config) {
    const algorithm = config.algorithm ?? 'HS256';
    if (!Object.hasOwn(hmacAlgorithms, algorithm)) {
        throw new Error(`Unsupported JWT session algorithm: ${algorithm}. Use HS256, HS384, or HS512.`);
    }
    return algorithm;
}
function getPositiveSeconds(value, fallback, label) {
    const expires = Number(value ?? fallback);
    if (!Number.isFinite(expires) || expires <= 0) {
        throw new Error(`${label} must be a positive number of seconds.`);
    }
    return Math.floor(expires);
}
function getRefreshTokenConfig(config) {
    const refreshToken = config.refreshToken;
    const refreshConfig = refreshToken === true ? {} : refreshToken || {};
    const enabled = refreshToken === true || !!(refreshToken && refreshConfig.enabled !== false);
    const defaultName = config.name ? `${config.name}-refresh` : 'lionrock-session-refresh';
    const expires = getPositiveSeconds(refreshConfig.expires, 60 * 60 * 24 * 30, 'JWT refreshToken.expires');
    return {
        enabled,
        name: refreshConfig.name ?? defaultName,
        expires,
        cookieMaxAge: refreshConfig.cookieMaxAge ?? expires,
        cookieOptions: refreshConfig.cookieOptions ?? {},
        rotate: refreshConfig.rotate !== false,
    };
}
function getAccessTokenConfig(config) {
    const accessConfig = config.accessToken || {};
    const expires = getPositiveSeconds(accessConfig.expires ?? config.expires, 60 * 60 * 2, 'JWT accessToken.expires');
    return {
        name: accessConfig.name ?? config.name,
        expires,
        cookieMaxAge: accessConfig.cookieMaxAge ?? config.cookieMaxAge,
        cookieOptions: accessConfig.cookieOptions ?? {},
    };
}
function getRequestEnv(options) {
    return options?.state?.get?.('request')?.env ?? {};
}
function getProcessEnv() {
    return Central.runtime?.process?.()?.env ?? globalThis.process?.env ?? {};
}
function getTokenFromAuthorizationHeader(options) {
    const request = options?.state?.get?.('request');
    const headers = request?.headers;
    if (!headers)
        return null;
    const authorization = typeof headers.get === 'function' ? headers.get('authorization') : headers.authorization;
    if (typeof authorization !== 'string')
        return null;
    const lower = authorization.toLowerCase();
    if (!lower.startsWith('bearer '))
        return null;
    return authorization.slice(7).trim() || null;
}
function writeResponseTokenHeaders(options, accessToken, refreshToken) {
    const headers = options?.state?.get?.('headers');
    if (!headers || typeof headers !== 'object')
        return;
    if (accessToken)
        headers['x-access-token'] = accessToken;
    if (refreshToken)
        headers['x-refresh-token'] = refreshToken;
}
function normalizeSecretList(value) {
    if (typeof value === 'string' && value.length > 0)
        return [value];
    if (!Array.isArray(value))
        return [];
    return value.filter((it) => typeof it === 'string' && it.length > 0);
}
function assertSecretStrength(secret, config) {
    const minimumSecretLength = Number(config.minimumSecretLength ?? 32);
    if (textEncoder.encode(secret).byteLength < minimumSecretLength) {
        throw new Error(`SESSION_SECRET must be at least ${minimumSecretLength} bytes for JWT sessions.`);
    }
}
function uniqueSecrets(secrets) {
    return [...new Set(secrets)];
}
function getCurrentSecret(options, config) {
    const requestEnv = getRequestEnv(options);
    const processEnv = getProcessEnv();
    const [secret] = uniqueSecrets([
        ...normalizeSecretList(requestEnv.SESSION_SECRET),
        ...normalizeSecretList(processEnv.SESSION_SECRET),
        ...normalizeSecretList(config.secret),
        ...normalizeSecretList(config.secrets).slice(0, 1),
    ]);
    if (!secret)
        throw new Error('SESSION_SECRET is required for JWT sessions.');
    assertSecretStrength(secret, config);
    return secret;
}
function getVerificationSecrets(options, config) {
    const requestEnv = getRequestEnv(options);
    const processEnv = getProcessEnv();
    const configSecrets = normalizeSecretList(config.secrets);
    const secrets = uniqueSecrets([
        getCurrentSecret(options, config),
        ...normalizeSecretList(requestEnv.SESSION_SECRET_PREVIOUS),
        ...normalizeSecretList(processEnv.SESSION_SECRET_PREVIOUS),
        ...normalizeSecretList(config.previousSecret),
        ...normalizeSecretList(config.previousSecrets),
        ...configSecrets.slice(1),
    ]);
    secrets.forEach(secret => assertSecretStrength(secret, config));
    return secrets;
}
async function importHmacKey(secret, algorithm, keyUsages) {
    return crypto.subtle.importKey('raw', textEncoder.encode(secret), {
        name: 'HMAC',
        hash: hmacAlgorithms[algorithm],
    }, false, keyUsages);
}
function getAudience(value) {
    if (typeof value === 'string')
        return [value];
    if (Array.isArray(value))
        return value.filter((it) => typeof it === 'string');
    return [];
}
function jwtError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}
function isRefreshableAccessError(error) {
    return error?.code === 'JWT_EXPIRED';
}
function assertClaimTimes(payload, config, expires) {
    const now = Math.floor(Date.now() / 1000);
    const clockTolerance = Number(config.clockTolerance ?? 60);
    if (typeof payload.exp !== 'number')
        throw new Error('JWT session is missing exp.');
    if (payload.exp <= now - clockTolerance)
        throw jwtError('JWT session has expired.', 'JWT_EXPIRED');
    if (typeof payload.nbf === 'number' && payload.nbf > now + clockTolerance) {
        throw new Error('JWT session is not active yet.');
    }
    if (typeof payload.iat === 'number' && payload.exp - payload.iat > expires + clockTolerance) {
        throw new Error('JWT session lifetime is longer than configured.');
    }
}
function assertIssuerAndAudience(payload, config) {
    if (config.issuer && payload.iss !== config.issuer) {
        throw new Error('JWT session issuer mismatch.');
    }
    const expectedAudience = getAudience(config.audience);
    if (expectedAudience.length === 0)
        return;
    const tokenAudience = getAudience(payload.aud);
    if (!tokenAudience.some(audience => expectedAudience.includes(audience))) {
        throw new Error('JWT session audience mismatch.');
    }
}
function assertTokenUse(payload, expectedTokenUse, allowMissingTokenUse = false) {
    if (!expectedTokenUse)
        return;
    if (payload.token_use === expectedTokenUse)
        return;
    if (allowMissingTokenUse && payload.token_use === undefined)
        return;
    throw new Error(`JWT ${expectedTokenUse} token use mismatch.`);
}
function toSessionPayload(session) {
    const payload = {};
    Object.entries(session).forEach(([key, value]) => {
        if (reservedClaims.has(key) || value === undefined)
            return;
        payload[key] = value;
    });
    return payload;
}
function toSessionData(payload) {
    const session = {};
    Object.entries(payload).forEach(([key, value]) => {
        if (reservedClaims.has(key) || value === undefined)
            return;
        session[key] = value;
    });
    return session;
}
function getCookieOptions(config, tokenConfig = {}, fallbackMaxAge) {
    const cookieConfig = Central.config.cookie ?? {};
    const cookieOptions = cookieConfig.options ?? cookieConfig;
    const options = {
        ...cookieOptions,
        ...(tokenConfig.cookieOptions ?? {}),
    };
    const maxAge = tokenConfig.cookieMaxAge ?? fallbackMaxAge;
    if (maxAge !== undefined)
        options.maxAge = Number(maxAge);
    return options;
}
async function signToken(session, config, tokenConfig, options, tokenUse) {
    const algorithm = getAlgorithm(config);
    const now = Math.floor(Date.now() / 1000);
    const header = {
        alg: algorithm,
        typ: 'JWT',
    };
    const payload = {
        ...toSessionPayload(session),
        iat: now,
        nbf: now,
        exp: now + tokenConfig.expires,
    };
    if (config.issuer)
        payload.iss = config.issuer;
    if (config.audience)
        payload.aud = config.audience;
    if (tokenUse)
        payload.token_use = tokenUse;
    payload.jti = await createJti(session, config, options, tokenUse);
    const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
    const key = await importHmacKey(getCurrentSecret(options, config), algorithm, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(signingInput));
    const jwt = `${signingInput}.${encodeBase64Url(signature)}`;
    const maxTokenLength = Number(config.maxTokenLength ?? 4096);
    if (jwt.length > maxTokenLength)
        throw new Error('JWT session cookie is too large.');
    await persistJti(payload, session, config, options, tokenUse);
    return jwt;
}
async function verifyToken(token, config, options, tokenConfig, tokenUse, allowMissingTokenUse = false) {
    const maxTokenLength = Number(config.maxTokenLength ?? 4096);
    if (token.length > maxTokenLength)
        throw new Error('JWT session cookie is too large.');
    const [encodedHeader, encodedPayload, encodedSignature, ...extraParts] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature || extraParts.length > 0) {
        throw new Error('Invalid JWT session format.');
    }
    const header = decodeJson(encodedHeader);
    const algorithm = getAlgorithm(config);
    if (header.alg !== algorithm)
        throw new Error('JWT session algorithm mismatch.');
    if (header.typ && header.typ !== 'JWT')
        throw new Error('JWT session type mismatch.');
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = decodeBase64Url(encodedSignature);
    let verified = false;
    for (const secret of getVerificationSecrets(options, config)) {
        const key = await importHmacKey(secret, algorithm, ['verify']);
        verified = await crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(signingInput));
        if (verified)
            break;
    }
    if (!verified)
        throw new Error('JWT session signature mismatch.');
    const payload = decodeJson(encodedPayload);
    assertClaimTimes(payload, config, tokenConfig.expires);
    assertIssuerAndAudience(payload, config);
    assertTokenUse(payload, tokenUse, allowMissingTokenUse);
    await verifyJti(payload, config, options, tokenUse);
    return payload;
}
function getResponseCookies(options) {
    const cookies = options?.state?.get?.('cookies');
    return Array.isArray(cookies) ? cookies : null;
}
async function queueAccessToken(session, config, options) {
    const responseCookies = getResponseCookies(options);
    if (!responseCookies)
        return;
    const accessConfig = getAccessTokenConfig(config);
    const token = await signToken(session, config, accessConfig, options, 'access');
    responseCookies.push({
        name: accessConfig.name,
        value: token,
        options: getCookieOptions(config, accessConfig),
    });
    if (config.authorizationHeader)
        writeResponseTokenHeaders(options, token);
}
async function queueRefreshToken(session, config, options) {
    const responseCookies = getResponseCookies(options);
    if (!responseCookies)
        return;
    const refreshConfig = getRefreshTokenConfig(config);
    const token = await signToken(session, config, refreshConfig, options, 'refresh');
    responseCookies.push({
        name: refreshConfig.name,
        value: token,
        options: getCookieOptions(config, refreshConfig, refreshConfig.expires),
    });
    if (config.authorizationHeader)
        writeResponseTokenHeaders(options, undefined, token);
}
async function readWithRefreshToken(cookies, config, options) {
    const refreshConfig = getRefreshTokenConfig(config);
    const refreshToken = cookies[refreshConfig.name];
    if (!refreshToken)
        return null;
    const payload = await verifyToken(refreshToken, config, options, refreshConfig, 'refresh');
    const session = {
        ...SessionJWT.create(),
        ...toSessionData(payload),
    };
    await queueAccessToken(session, config, options);
    if (refreshConfig.rotate)
        await queueRefreshToken(session, config, options);
    return session;
}
export default class SessionJWT extends AbstractAdapterSession {
    static async read(cookies, options) {
        const config = getConfig(options);
        const refreshConfig = getRefreshTokenConfig(config);
        const accessConfig = getAccessTokenConfig(config);
        // When authorizationHeader is enabled, try Bearer token from the Authorization header first.
        // This allows cross-domain clients to pass the JWT in the Authorization header instead of cookies.
        if (config.authorizationHeader) {
            const headerToken = getTokenFromAuthorizationHeader(options);
            if (headerToken) {
                const payload = await verifyToken(headerToken, config, options, accessConfig, refreshConfig.enabled ? 'access' : undefined, true);
                return { ...this.create(), ...toSessionData(payload) };
            }
        }
        const accessToken = cookies[accessConfig.name];
        if (accessToken) {
            try {
                const payload = await verifyToken(accessToken, config, options, accessConfig, refreshConfig.enabled ? 'access' : undefined, true);
                return {
                    ...this.create(),
                    ...toSessionData(payload),
                };
            }
            catch (error) {
                if (!refreshConfig.enabled || !isRefreshableAccessError(error))
                    throw error;
            }
        }
        if (refreshConfig.enabled) {
            const session = await readWithRefreshToken(cookies, config, options);
            if (session)
                return session;
        }
        return this.create();
    }
    static async write(session, cookies, options) {
        const config = getConfig(options);
        const refreshConfig = getRefreshTokenConfig(config);
        const accessConfig = getAccessTokenConfig(config);
        if (!session.id)
            session.id = randomUUID();
        const accessToken = await signToken(session, config, accessConfig, options, refreshConfig.enabled ? 'access' : undefined);
        cookies.push({
            name: accessConfig.name,
            value: accessToken,
            options: getCookieOptions(config, accessConfig),
        });
        if (!refreshConfig.enabled) {
            if (config.authorizationHeader)
                writeResponseTokenHeaders(options, accessToken);
            return;
        }
        const refreshToken = await signToken(session, config, refreshConfig, options, 'refresh');
        cookies.push({
            name: refreshConfig.name,
            value: refreshToken,
            options: getCookieOptions(config, refreshConfig, refreshConfig.expires),
        });
        if (config.authorizationHeader)
            writeResponseTokenHeaders(options, accessToken, refreshToken);
    }
}
