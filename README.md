# adapter-session
LionrockJS Session Adapters

## JWT Session Secret

`SessionJWT` signs and verifies cookies with `SESSION_SECRET` using Web Crypto HMAC.
The default algorithm is `HS256`; `HS384` and `HS512` are also supported through
`Central.config.session.algorithm`. The adapter rejects tokens that use a different
algorithm than the configured one.

The secret is resolved in this order:

1. `request.env.SESSION_SECRET`, for runtimes such as Cloudflare Workers.
2. `process.env.SESSION_SECRET`, for Node.js.
3. `Central.config.session.secret`, for explicit application config.

`SESSION_SECRET` must be at least 32 bytes by default. Generate one with:

```bash
openssl rand -base64 32
```

To rotate secrets, deploy a new `SESSION_SECRET` with the old secret in
`SESSION_SECRET_PREVIOUS`, wait longer than the session TTL, then remove
`SESSION_SECRET_PREVIOUS`.

JWT sessions are stateless, so logout cannot revoke an already issued token before
`exp`. For high-risk admin systems, prefer a database-backed session adapter or
store a `jti` or session version in the database and check it on each request.

## Access and refresh tokens

By default, the adapter writes one JWT cookie named by `Central.config.session.name`.
To enable access and refresh tokens, configure `refreshToken`:

```js
export default {
  name: '__Host-lionrock-session',
  algorithm: 'HS256',
  accessToken: {
    expires: 15 * 60,
    cookieMaxAge: 15 * 60,
  },
  refreshToken: {
    enabled: true,
    name: '__Host-lionrock-session-refresh',
    expires: 60 * 60 * 24 * 7,
    cookieMaxAge: 60 * 60 * 24 * 7,
    rotate: true,
  },
}
```

When enabled, `name`/`accessToken.name` is the access-token cookie. The refresh
cookie defaults to `${name}-refresh`. If the access token is missing or expired
and the refresh token is valid, `read()` returns the session and queues a fresh
access-token cookie in the controller response. With `refreshToken.rotate !== false`,
it also queues a rotated refresh-token cookie.

Refresh tokens in this adapter are still stateless JWTs. That is convenient for
Workers, but it cannot detect replay or revoke a stolen refresh token on its own.

## DB-backed jti

`SessionJWT` can persist and verify JWT ids (`jti`) with your database.
Enable `session.jti` and provide `persist` and `verify` callbacks.

```js
const refreshJtiTable = new Map();

export default {
  refreshToken: {
    enabled: true,
    rotate: true,
  },
  jti: {
    enabled: true,
    tokenUse: 'refresh', // access | refresh | both
    require: true,
    async persist({ jti, session, exp, tokenUse }) {
      if (tokenUse !== 'refresh') return;
      refreshJtiTable.set(session.sid, { jti, exp });
    },
    async verify({ jti, session, tokenUse }) {
      if (tokenUse !== 'refresh') return true;
      return refreshJtiTable.get(session.sid)?.jti === jti;
    },
  },
}
```

Callback arguments:

1. `jti`: JWT id claim.
2. `session`: session payload (`id`, `sid`, and custom fields).
3. `tokenUse`: `access` or `refresh`.
4. `exp`: token expiration timestamp (seconds).
5. `payload`: full JWT payload.
6. `config` and `options`: merged session config and request options.

If `verify` returns `false`, the token is rejected as revoked.
