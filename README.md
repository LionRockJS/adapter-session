# adapter-session
LionrockJS Session Adapters

## JWT Session Secret

`SessionJWT` signs and verifies cookies with `SESSION_SECRET`.

The secret is resolved in this order:

1. `request.env.SESSION_SECRET`, for runtimes such as Cloudflare Workers.
2. `process.env.SESSION_SECRET`, for Node.js.
3. `Central.config.session.secret`, for explicit application config.
