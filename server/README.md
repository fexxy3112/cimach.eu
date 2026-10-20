# CIMACH CMS API

Express API for the existing CIMACH React/Vite application. The public portfolio and its `/pl/login` and `/en/login` routes are unchanged; login calls the existing auth endpoints. API paths remain `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, `/api/admin`, and `/api/healthz`.

## Structure

```text
server/
  data/legacy-projects.json    Verified snapshot of the existing React project data
  migrations/                 Versioned, additive MySQL migrations
  scripts/                    Migration, import, and administrator CLI entrypoints
  src/
    config/env.js              Validated environment configuration
    database/client.js         mysql2 connection pool
    database/models/            Parameterized user and session queries
    database/models/project.model.js
    routes/                     API route registration and auth routes
    controllers/                HTTP request/response handling
    services/                   Authentication business logic
    middleware/                 Auth, CSRF, rate limiting, errors
    validators/                 Request validation
    utils/                      JWT and cookie helpers
    app.js                      Express middleware and router setup
    index.js                    Database probe and server startup
  test/
```

The project does not currently use an ORM. The auth schema is small and already uses parameterized `mysql2` queries, so introducing Prisma would add a second schema/migration model and require an unverified database conversion. The model layer keeps SQL out of HTTP handlers while retaining the existing database and API contract. Future `Project`, `ProjectImage`, and `Category` models can follow the same pattern when those features are implemented.

## Local setup

1. Create `server/.env` with the configuration variables listed below and set the local database values. Generate a fresh JWT secret without putting it in a command argument or source file:

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(64).toString('base64') + '\n')"
   ```

2. From `server/`, install dependencies with `npm ci`.
3. Run `npm run db:migrate` to apply pending versioned migrations.
4. Run `npm run admin:create` in an interactive terminal. It asks for an email and hidden password, hashes it with bcrypt, and creates only the first administrator.
5. Run `npm run dev` from `server/`; start the Vite frontend separately from `app/`.

## Database and migrations

`mysql2/promise` is the only database access layer. `schema_migrations` records each version in `migrations/`; `npm run db:migrate` is the single migration entrypoint. A database lock prevents concurrent migration runs. MySQL DDL implicitly commits, so migrations are written to be safely retryable rather than relying on a transaction around DDL.

`001-auth-schema.js` creates `users` and `auth_sessions` only when absent. If a `users` table already exists, it validates the columns, key, and types required by auth, then adds `created_at`/`updated_at` if missing. Those timestamp additions are non-destructive. An incompatible schema stops the migration with an error; it does not drop or reset tables. Existing users are preserved. The migration can be rerun after a partial DDL failure.

Before running migrations on production, take a database backup and inspect the target schema. Production schema compatibility was not verifiable from this repository. Apply the same command in a controlled deployment step:

```sh
cd server && npm ci && npm run db:migrate
```

## Authentication and API

- Login uses bcrypt comparison and the same `401 invalid_credentials` response for unknown accounts and incorrect passwords. There is no public registration.
- JWTs use HS256 and a short configured lifetime. The browser receives the token only in an HttpOnly cookie. A database session row is checked for every protected request and marked revoked on logout.
- State-changing API requests require the configured exact `Origin` and `X-CIMACH-CSRF: 1`. CORS permits credentials only for `FRONTEND_ORIGIN`.
- Login is limited to five unsuccessful attempts per IP per 15 minutes. The default rate-limit store is in process and therefore only coordinates a single API instance. Use a shared express-rate-limit store before running multiple instances.
- `GET /api/admin` is an authenticated admin-only foundation endpoint. Mount future CMS endpoints behind `createAuthenticate` and the appropriate role check; frontend route guards are not authorization.
- The API binds to `127.0.0.1`. Apache deployment requires working `mod_rewrite`, `mod_proxy`, and `mod_proxy_http` rules for `/api`, plus `TRUST_PROXY_CIDRS` set to the actual proxy addresses. Do not set trust proxy to `true` indiscriminately.

## Environment

Required variables are `NODE_ENV`, `PORT`, `FRONTEND_ORIGIN`, `JWT_SECRET_BASE64`, `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_TTL_SECONDS`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_CONNECTION_LIMIT`, `TRUST_PROXY_CIDRS`, `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SAME_SITE`, and `AUTH_COOKIE_DOMAIN`. For local Vite, use `NODE_ENV=development`, `FRONTEND_ORIGIN=http://localhost:5173`, `PORT=3001`, and a local MySQL connection. Generate at least 32 random bytes for `JWT_SECRET_BASE64`. Production additionally requires HTTPS for `FRONTEND_ORIGIN` and explicit `TRUST_PROXY_CIDRS`. `.env` and `.env.example` are ignored by Git in this repository because a filled example file previously exposed credentials; do not force-add them.

## Projects data migration

The current public data contains three active project entries in the same order in `app/src/data/portfolio.ts` and `portfolio-en.ts`: CIMACH, Studio BodyArt, and Experiments. The visible `03` block is commented out and is not imported. Studio BodyArt has the only current case-study slug (`studio-bodyart`) and three remote gallery images in `app/src/data/project-previews.ts`. No project has a main-image reference. Project-specific SEO exists only for Studio BodyArt in `app/src/seo.ts` and is included in the import snapshot.

`data/legacy-projects.json` is a generated import snapshot. Run `npm run projects:snapshot` from `server/` to rebuild it from the current TypeScript/SEO sources (requires the app dependencies to be installed), then review the diff. The importer verifies SHA-256 hashes of those source files before using the snapshot. Source files are never rewritten by the importer.

The additive `002-project-catalog` migration creates `projects`, `project_translations`, `project_technologies`, and `project_images`. Existing localized title, category, description, SEO, and technology values are retained separately per locale. Existing external project URLs and the Studio BodyArt route slug are preserved. Legacy projects are published because they are currently public; their historical publication dates and main-image references are absent, so `published_at` and `main_image_url` remain `NULL`. `created_at` and `updated_at` use the database import time.

After verifying database access and reviewing a backup, run:

```sh
npm run db:migrate
npm run projects:import -- --source-only  # validates snapshot/source fingerprints without a database
npm run projects:import                   # read-only database dry run; SELECT queries only
npm run projects:import -- --apply        # inserts missing records in one transaction
```

The importer uses stable `source_key` values and never updates an already imported record, so reruns do not duplicate or overwrite later CMS edits. It reports valid, skipped, already imported, and inserted records. The `--apply` mode aborts if source records are invalid. Review dry-run counts and source details before applying.

Public endpoints are `GET /api/projects?locale=pl|en` and `GET /api/projects/:slug?locale=pl|en`. They return only `published` projects, map to the current card/detail fields, and omit internal IDs and source keys. No administrative project write endpoints are included yet.

The frontend remains connected to the static React data. Its Vite plugin prerenders pages and project SEO into HTML, and the live database was unavailable during this work. Do not switch the frontend to runtime-only API fetching: first run the migration/import, compare all records and images, then add database-backed prerendering for the existing route and future case studies. The current project count and URL behavior should be checked against the database before that switch.

Useful scripts: `npm run dev`, `npm start`, `npm test`, `npm run db:migrate`, `npm run projects:import`, and `npm run admin:create`.
