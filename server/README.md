# CIMACH authentication API

This is a separate Express application in `/server`. It serves the API on `127.0.0.1:3001`; Vite proxies `/api` locally and Apache can proxy `/api` in production. The browser keeps the short-lived HS256 access JWT only in an HttpOnly cookie. Each protected request checks both the JWT and its server-side session row, so logout revokes a token immediately. There is no refresh token or public registration.

## Local setup

1. Copy `.env.example` to `.env`, set database connection values, then create a random JWT key:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(64).toString('base64'))"
   ```

2. Install dependencies with `npm install` in this directory.
3. Run `npm run db:migrate`.
4. Run `npm run admin:create` in an interactive terminal. The password is entered with masked characters, confirmed, hashed with bcrypt, and never accepted as a command-line argument.
5. Start the API with `npm run dev`. Start the frontend separately in `/app`.

The migration uses an existing `users` table only if it has the supported `id`, `email`, `password_hash`, `role`, and `is_active` schema, with a unique email key and a compatible integer ID. It stops without modifying that table when it is incompatible. If no users table exists, it creates one. `auth_sessions` stores session ID, user ID, expiry, and revocation time; it never stores JWTs.

## Production requirements

- Set `NODE_ENV=production`, use HTTPS, set `FRONTEND_ORIGIN=https://cimach.eu`, and provide all `DB_*` values plus a fresh `JWT_SECRET_BASE64` with at least 32 random bytes. Do not use the checked-in example values or the frontend's `app/.env` as an API secret store.
- Run the Node process under a service manager and keep port 3001 bound to localhost. The Apache proxy rule in `app/public/.htaccess` requires `mod_rewrite`, `mod_proxy`, and `mod_proxy_http`. Confirm those modules and Node hosting are available with the hosting provider before deployment.
- The default cookie is host-only, HttpOnly, Secure in production, SameSite=Strict, and scoped to `/api`. If the API is moved to another site, update the exact `FRONTEND_ORIGIN`, frontend `VITE_API_BASE_URL`, CORS, cookie SameSite/Secure, and browser credentials together. Cross-site cookies may be blocked by browser privacy settings.
- In production, `TRUST_PROXY_CIDRS` is required because this server binds to loopback behind a proxy. For same-host Apache, use `127.0.0.1/32,::1/128`; otherwise configure only the actual proxy address/subnet. Never set trust proxy to `true` just to make IP detection work.
- Login rate limiting is 5 unsuccessful requests per IP per 15 minutes. The default in-memory store is appropriate only for a single API process; multiple instances need a shared express-rate-limit store before deployment.
- The API checks an exact `Origin` and a custom `X-CIMACH-CSRF: 1` header on every state-changing `/api` request. CORS allows credentials only from the configured frontend origin.
- `GET /api/admin` is a protected foundation endpoint and requires the `admin` role. Future CMS routes must be mounted behind the same `authenticate` and role middleware. The React `/pl/admin` and `/en/admin` guard is only UI behavior.

No production database connection or hosting topology was available in the project during implementation. Run the migration against the intended database only after confirming its schema and taking the usual database backup. The migration's checks are deliberately fail-closed.
