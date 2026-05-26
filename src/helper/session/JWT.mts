import { Central } from '@lionrockjs/central';
import { AbstractAdapterSession } from "@lionrockjs/mixin-session";

type SessionData = {
  id: string | null;
  sid: string;
  creator: string;
  [key: string]: any;
};

type JwtHeader = {
  alg?: string;
  typ?: string;
};

type JwtPayload = Record<string, any> & {
  aud?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  token_use?: string;
};

type TokenUse = 'access' | 'refresh';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const hmacAlgorithms = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
} as const;
const reservedClaims = new Set(['aud', 'exp', 'iat', 'iss', 'nbf', 'token_use']);

function randomUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  if (!crypto.getRandomValues) throw new Error('Session ID generation requires crypto.getRandomValues');

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function encodeBase64Url(input: ArrayBuffer | Uint8Array) {
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

  const BufferClass = (globalThis as any).Buffer;
  if (!BufferClass) throw new Error('JWT base64url encoding requires btoa or Buffer.');

  return BufferClass.from(bytes)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decodeBase64Url(input: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new Error('Invalid JWT base64url payload.');

  const padding = input.length % 4;
  if (padding === 1) throw new Error('Invalid JWT base64url length.');

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

  const BufferClass = (globalThis as any).Buffer;
  if (!BufferClass) throw new Error('JWT base64url decoding requires atob or Buffer.');

  return new Uint8Array(BufferClass.from(base64, 'base64'));
}

function encodeJson(value: any) {
  return encodeBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(textDecoder.decode(decodeBase64Url(value))) as T;
}

function getConfig(options: any) {
  return {
    ...Central.config.session,
    ...options,
  };
}

function getAlgorithm(config: any): keyof typeof hmacAlgorithms {
  const algorithm = config.algorithm ?? 'HS256';

  if (!Object.hasOwn(hmacAlgorithms, algorithm)) {
    throw new Error(`Unsupported JWT session algorithm: ${algorithm}. Use HS256, HS384, or HS512.`);
  }

  return algorithm;
}

function getPositiveSeconds(value: any, fallback: number, label: string) {
  const expires = Number(value ?? fallback);

  if (!Number.isFinite(expires) || expires <= 0) {
    throw new Error(`${label} must be a positive number of seconds.`);
  }

  return Math.floor(expires);
}

function getRefreshTokenConfig(config: any) {
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

function getAccessTokenConfig(config: any) {
  const accessConfig = config.accessToken || {};
  const expires = getPositiveSeconds(accessConfig.expires ?? config.expires, 60 * 60 * 2, 'JWT accessToken.expires');

  return {
    name: accessConfig.name ?? config.name,
    expires,
    cookieMaxAge: accessConfig.cookieMaxAge ?? config.cookieMaxAge,
    cookieOptions: accessConfig.cookieOptions ?? {},
  };
}

function getRequestEnv(options: any) {
  return options?.state?.get?.('request')?.env ?? {};
}

function getProcessEnv() {
  return Central.runtime?.process?.()?.env ?? (globalThis as any).process?.env ?? {};
}

function normalizeSecretList(value: any): string[] {
  if (typeof value === 'string' && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];

  return value.filter((it): it is string => typeof it === 'string' && it.length > 0);
}

function assertSecretStrength(secret: string, config: any) {
  const minimumSecretLength = Number(config.minimumSecretLength ?? 32);

  if (textEncoder.encode(secret).byteLength < minimumSecretLength) {
    throw new Error(`SESSION_SECRET must be at least ${minimumSecretLength} bytes for JWT sessions.`);
  }
}

function uniqueSecrets(secrets: string[]) {
  return [...new Set(secrets)];
}

function getCurrentSecret(options: any, config: any) {
  const requestEnv = getRequestEnv(options);
  const processEnv = getProcessEnv();
  const [secret] = uniqueSecrets([
    ...normalizeSecretList(requestEnv.SESSION_SECRET),
    ...normalizeSecretList(processEnv.SESSION_SECRET),
    ...normalizeSecretList(config.secret),
    ...normalizeSecretList(config.secrets).slice(0, 1),
  ]);

  if (!secret) throw new Error('SESSION_SECRET is required for JWT sessions.');
  assertSecretStrength(secret, config);

  return secret;
}

function getVerificationSecrets(options: any, config: any) {
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

async function importHmacKey(secret: string, algorithm: keyof typeof hmacAlgorithms, keyUsages: KeyUsage[]) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    {
      name: 'HMAC',
      hash: hmacAlgorithms[algorithm],
    },
    false,
    keyUsages
  );
}

function getAudience(value: any): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.filter((it): it is string => typeof it === 'string');

  return [];
}

function jwtError(message: string, code: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;

  return error;
}

function isRefreshableAccessError(error: any) {
  return error?.code === 'JWT_EXPIRED';
}

function assertClaimTimes(payload: JwtPayload, config: any, expires: number) {
  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = Number(config.clockTolerance ?? 60);

  if (typeof payload.exp !== 'number') throw new Error('JWT session is missing exp.');
  if (payload.exp <= now - clockTolerance) throw jwtError('JWT session has expired.', 'JWT_EXPIRED');
  if (typeof payload.nbf === 'number' && payload.nbf > now + clockTolerance) {
    throw new Error('JWT session is not active yet.');
  }
  if (typeof payload.iat === 'number' && payload.exp - payload.iat > expires + clockTolerance) {
    throw new Error('JWT session lifetime is longer than configured.');
  }
}

function assertIssuerAndAudience(payload: JwtPayload, config: any) {
  if (config.issuer && payload.iss !== config.issuer) {
    throw new Error('JWT session issuer mismatch.');
  }

  const expectedAudience = getAudience(config.audience);
  if (expectedAudience.length === 0) return;

  const tokenAudience = getAudience(payload.aud);
  if (!tokenAudience.some(audience => expectedAudience.includes(audience))) {
    throw new Error('JWT session audience mismatch.');
  }
}

function assertTokenUse(payload: JwtPayload, expectedTokenUse?: TokenUse, allowMissingTokenUse = false) {
  if (!expectedTokenUse) return;
  if (payload.token_use === expectedTokenUse) return;
  if (allowMissingTokenUse && payload.token_use === undefined) return;

  throw new Error(`JWT ${expectedTokenUse} token use mismatch.`);
}

function toSessionPayload(session: SessionData) {
  const payload: Record<string, any> = {};

  Object.entries(session).forEach(([key, value]) => {
    if (reservedClaims.has(key) || value === undefined) return;
    payload[key] = value;
  });

  return payload;
}

function toSessionData(payload: JwtPayload) {
  const session: Record<string, any> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (reservedClaims.has(key) || value === undefined) return;
    session[key] = value;
  });

  return session;
}

function getCookieOptions(config: any, tokenConfig: any = {}, fallbackMaxAge?: number) {
  const cookieConfig = Central.config.cookie ?? {};
  const cookieOptions = cookieConfig.options ?? cookieConfig;
  const options = {
    ...cookieOptions,
    ...(tokenConfig.cookieOptions ?? {}),
  };

  const maxAge = tokenConfig.cookieMaxAge ?? fallbackMaxAge;
  if (maxAge !== undefined) options.maxAge = Number(maxAge);

  return options;
}

async function signToken(session: SessionData, config: any, tokenConfig: any, options: any, tokenUse?: TokenUse) {
  const algorithm = getAlgorithm(config);
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: algorithm,
    typ: 'JWT',
  };
  const payload: JwtPayload = {
    ...toSessionPayload(session),
    iat: now,
    nbf: now,
    exp: now + tokenConfig.expires,
  };

  if (config.issuer) payload.iss = config.issuer;
  if (config.audience) payload.aud = config.audience;
  if (tokenUse) payload.token_use = tokenUse;

  const signingInput = `${encodeJson(header)}.${encodeJson(payload)}`;
  const key = await importHmacKey(getCurrentSecret(options, config), algorithm, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(signingInput));
  const jwt = `${signingInput}.${encodeBase64Url(signature)}`;
  const maxTokenLength = Number(config.maxTokenLength ?? 4096);

  if (jwt.length > maxTokenLength) throw new Error('JWT session cookie is too large.');

  return jwt;
}

async function verifyToken(token: string, config: any, options: any, tokenConfig: any, tokenUse?: TokenUse, allowMissingTokenUse = false) {
  const maxTokenLength = Number(config.maxTokenLength ?? 4096);
  if (token.length > maxTokenLength) throw new Error('JWT session cookie is too large.');

  const [encodedHeader, encodedPayload, encodedSignature, ...extraParts] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature || extraParts.length > 0) {
    throw new Error('Invalid JWT session format.');
  }

  const header = decodeJson<JwtHeader>(encodedHeader);
  const algorithm = getAlgorithm(config);
  if (header.alg !== algorithm) throw new Error('JWT session algorithm mismatch.');
  if (header.typ && header.typ !== 'JWT') throw new Error('JWT session type mismatch.');

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = decodeBase64Url(encodedSignature);
  let verified = false;

  for (const secret of getVerificationSecrets(options, config)) {
    const key = await importHmacKey(secret, algorithm, ['verify']);
    verified = await crypto.subtle.verify('HMAC', key, signature, textEncoder.encode(signingInput));
    if (verified) break;
  }

  if (!verified) throw new Error('JWT session signature mismatch.');

  const payload = decodeJson<JwtPayload>(encodedPayload);
  assertClaimTimes(payload, config, tokenConfig.expires);
  assertIssuerAndAudience(payload, config);
  assertTokenUse(payload, tokenUse, allowMissingTokenUse);

  return payload;
}

function getResponseCookies(options: any) {
  const cookies = options?.state?.get?.('cookies');
  return Array.isArray(cookies) ? cookies : null;
}

async function queueAccessToken(session: SessionData, config: any, options: any) {
  const responseCookies = getResponseCookies(options);
  if (!responseCookies) return;

  const accessConfig = getAccessTokenConfig(config);
  responseCookies.push({
    name: accessConfig.name,
    value: await signToken(session, config, accessConfig, options, 'access'),
    options: getCookieOptions(config, accessConfig),
  });
}

async function queueRefreshToken(session: SessionData, config: any, options: any) {
  const responseCookies = getResponseCookies(options);
  if (!responseCookies) return;

  const refreshConfig = getRefreshTokenConfig(config);
  responseCookies.push({
    name: refreshConfig.name,
    value: await signToken(session, config, refreshConfig, options, 'refresh'),
    options: getCookieOptions(config, refreshConfig, refreshConfig.expires),
  });
}

async function readWithRefreshToken(cookies: Record<string, string>, config: any, options: any) {
  const refreshConfig = getRefreshTokenConfig(config);
  const refreshToken = cookies[refreshConfig.name];
  if (!refreshToken) return null;

  const payload = await verifyToken(refreshToken, config, options, refreshConfig, 'refresh');
  const session = {
    ...SessionJWT.create(),
    ...toSessionData(payload),
  } as SessionData;

  await queueAccessToken(session, config, options);
  if (refreshConfig.rotate) await queueRefreshToken(session, config, options);

  return session;
}

export default class SessionJWT extends AbstractAdapterSession {
  static async read(cookies: Record<string, string>, options: any): Promise<SessionData> {
    const config = getConfig(options);
    const refreshConfig = getRefreshTokenConfig(config);
    const accessConfig = getAccessTokenConfig(config);
    const accessToken = cookies[accessConfig.name];

    if (accessToken) {
      try {
        const payload = await verifyToken(accessToken, config, options, accessConfig, refreshConfig.enabled ? 'access' : undefined, true);

        return {
          ...this.create(),
          ...toSessionData(payload),
        } as SessionData;
      } catch (error) {
        if (!refreshConfig.enabled || !isRefreshableAccessError(error)) throw error;
      }
    }

    if (refreshConfig.enabled) {
      const session = await readWithRefreshToken(cookies, config, options);
      if (session) return session;
    }

    return this.create();
  }

  static async write(session: SessionData, cookies: any[], options: any): Promise<void> {
    const config = getConfig(options);
    const refreshConfig = getRefreshTokenConfig(config);
    const accessConfig = getAccessTokenConfig(config);

    if (!session.id) session.id = randomUUID();

    cookies.push({
      name: accessConfig.name,
      value: await signToken(session, config, accessConfig, options, refreshConfig.enabled ? 'access' : undefined),
      options: getCookieOptions(config, accessConfig),
    });

    if (!refreshConfig.enabled) return;

    cookies.push({
      name: refreshConfig.name,
      value: await signToken(session, config, refreshConfig, options, 'refresh'),
      options: getCookieOptions(config, refreshConfig, refreshConfig.expires),
    });
  }
}
