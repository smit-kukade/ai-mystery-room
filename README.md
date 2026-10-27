# AI Mystery Room

A fictional, text-first detective mystery game built with React, TypeScript, Express, MongoDB, and the Groq API. Accounts use Argon2id password hashes and MongoDB-backed server sessions. Mysteries created after sign-in are owned by that account and protected by backend authorization.

## Requirements

- Node.js 22 or newer and npm
- MongoDB running locally or a MongoDB connection string
- A Groq API key for mystery generation

## Run locally

1. If `server/.env` does not already exist, copy `server/.env.example` to `server/.env`. Do not overwrite an existing environment file.
2. Set `NODE_ENV=development`, `MONGODB_URI`, `GROQ_API_KEY`, and `SESSION_SECRET` in `server/.env`. Generate `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` and store it privately. The server rejects missing, short, and obvious placeholder secrets; a length check alone cannot prove that a secret is random.
3. Keep `CLIENT_ORIGIN=http://localhost:5173` for the Vite development server. `CLIENT_ORIGIN` must be only an origin (scheme, host, and optional port), with no credentials, path, query, or fragment.
4. Install and build shared contracts: `npm install` then `npm run build`.
5. Start client and API: `npm run dev`.
6. Open `http://localhost:5173`. The API health endpoint is `http://localhost:4000/api/v1/health`.

The client proxies `/api` requests to the API. The backend requires MongoDB and a configured session secret. New account registration requires a name, email, and password with at least 12 characters. This phase does not include email verification or password recovery. The API issues a 14-day HttpOnly session cookie and requires a session CSRF token plus a matching origin for state-changing requests.

## Accounts and existing mysteries

Each new account's mysteries are private to that account. Every mystery API operation requires authentication; reads and investigation updates are scoped to the signed-in owner's ID. Password hashes are never included in API responses. Session records are stored in MongoDB's `sessions` collection with a 14-day TTL.

Existing mystery documents are left unchanged and remain ownerless. They do not appear in user history and cannot be opened through normal mystery APIs. No automatic claim or data migration is run. An owner assignment for any legacy record would require a separately reviewed, explicit process.

## Architecture

- `client/`: responsive React/Vite interface, registration and login screens, session restoration, protected mystery routes, and the existing mystery workflow.
- `server/`: Express API, MongoDB User and Case models, MongoDB session storage, ownership and CSRF middleware, generation adapter, and explicit player DTO mapping.
- `shared/`: Zod request and generation schemas shared by client and server.

The session cookie is `amr.sid` for local HTTP and `__Host-amr.sid` in production. Production cookies are Secure, HttpOnly, SameSite=Lax, and scoped to `/`. Express trusts the Render proxy in production so Secure cookies work behind TLS termination.

## API

- `GET /api/v1/health` (public)
- `GET /api/v1/auth/me` (public session/CSRF bootstrap)
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/cases` (authenticated, CSRF and origin checked)
- `GET /api/v1/cases` (authenticated, owner's mysteries only)
- `GET /api/v1/cases/:caseId` (authenticated, owner only)
- `POST /api/v1/cases/:caseId/accusation` (authenticated, owner only, CSRF and origin checked)

For unsafe requests, obtain `csrfToken` from `/api/v1/auth/me` and send it as `X-CSRF-Token`; browser requests must also send the configured `Origin`. The Vite proxy preserves the local browser origin.

## Tests and checks

- `npm run typecheck`
- `npm run build`
- `npm run test --workspace server`

The server tests use `mongodb-memory-server` and an isolated temporary MongoDB instance. They do not use the configured application database. The first test run may download a MongoDB test binary.

## Render configuration

Before deploying, set these values in the Render service environment:

- `MONGODB_URI`: the intended MongoDB connection string.
- `SESSION_SECRET`: generate a unique value with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`, then enter it directly in Render's secret environment setting. Keep it out of source control. The server checks minimum length and rejects common placeholders; it cannot determine whether a sufficiently long value was generated randomly.
- `CLIENT_ORIGIN`: the exact public origin shown for the deployed Render service or its custom domain, for example `https://your-service.onrender.com`. Use HTTPS and provide only the origin: no credentials, path, query, fragment, or trailing slash.
- `GROQ_API_KEY`: the key used for mystery generation.

The repository's `render.yaml` declares these values as dashboard-managed (`sync: false`). No production database migration is required or performed for ownership; legacy documents remain unassigned and excluded from user queries.

All generated evidence is fictional and simulated. Generation is synchronous with a bounded timeout and one schema/semantic repair attempt.
