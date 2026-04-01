# SAT Changelog Backend

Node.js + Express + Apollo Server backend for the SAT Changelog platform.

This service provides:

- GraphQL API at `/graphql`
- Health endpoint at `/health`
- JWT-based admin authentication through GraphQL
- API-key-based access for embed and public application flows
- MongoDB persistence
- Optional S3 integration for uploads, downloads, and immutable changelog snapshots

## Stack

- Node.js 20+
- Express 4
- Apollo Server 4
- MongoDB + Mongoose
- Joi
- JWT
- AWS S3 SDK

## Requirements

- Node.js 20 or newer
- npm 10+ recommended
- MongoDB
- AWS S3 credentials for upload-dependent features

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env`:

```env
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/sat_changelog
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=replace-with-a-long-random-secret
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=sat-changelog-assets
APP_BASE_URL=http://localhost:4000
```

Start the server in development:

```bash
npm run dev
```

Start the server in production mode:

```bash
npm run start
```

## Available Scripts

```bash
npm run dev
npm run start
npm run test
npm run test:json
npm run report:auto-issues
npm run seed:data
npm run seed:translations
npm run seed:translations:reset
```

## Runtime Endpoints

- `GET /health`
- `POST /graphql`

Notes:

- The current server bootstrap exposes GraphQL auth through the schema itself
- A REST auth file exists in the repo, but it is not mounted by the current Express bootstrap

## Environment Variables

### Required

- `MONGO_URI`
- `JWT_SECRET`
- `ENCRYPTION_KEY`

### Strongly Recommended

- `NODE_ENV`
- `PORT`
- `JWT_EXPIRES_IN`
- `APP_BASE_URL`

### Required For S3-Dependent Features

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`

### Variable Notes

- `APP_BASE_URL` is used when generating embed instructions and backend-origin URLs
- `ENCRYPTION_KEY` is used by API key crypto flows and should be treated as a secret
- `JWT_SECRET` must be unique per environment

## Seeding

### Main domain data

Seeds applications, API keys, roadmap phases, changelogs, evolution requests, users, and documentation data.

```bash
npm run seed:data
```

Important:

- This script resets the main seeded domain data
- It does not seed translations anymore
- It prints seed-only plaintext API keys once during execution

### Translations

Seed missing translations only:

```bash
npm run seed:translations
```

Reset all translation rows and recreate them from source definitions:

```bash
npm run seed:translations:reset
```

Important:

- `seed:translations` preserves existing DB-edited values
- `seed:translations:reset` is destructive for translation content

### Initial admin user

There is also a separate admin bootstrap script:

```bash
node src/scripts/seed_admin.js
```

Default credentials created by that script:

- email: `admin@changelog.internal`
- password: `Admin1234!`

Change the password immediately after first login.

## Auth Model

This backend supports two auth modes:

- Admin JWT auth for internal/admin GraphQL operations
- API key auth for embed and application-scoped public operations

Important:

- API keys start with `zbk_`
- API keys are not retrievable after creation except for the short-lived DEV test flow
- `/Embed`-style consumers are expected to authenticate with API keys, not admin JWT

## Production Notes

### CORS

The current bootstrap uses permissive CORS in non-production and restrictive CORS in production.

Current behavior:

- development: `origin: "*"`
- production: no cross-origin browser access allowed by default

That means if the frontend and backend are hosted on different origins in production, browser calls will fail unless you change the server CORS configuration.

### Introspection and errors

- GraphQL introspection is disabled in production
- GraphQL error output is sanitized in production

### Health checks

Use `/health` for container, load balancer, or uptime checks.

## S3-Dependent Features

The following features depend on valid AWS S3 configuration:

- application icon upload
- evolution request attachment upload
- documentation download URLs
- immutable changelog snapshot upload on publish

If S3 is not configured, those features will fail even if the rest of the API is healthy.

## Deployment

Typical production setup:

1. Build your deployment artifact or image
2. Provide environment variables securely
3. Ensure MongoDB is reachable
4. Ensure AWS credentials and bucket access are valid if upload features are needed
5. Run the service behind a reverse proxy, ingress, or load balancer
6. Expose `/graphql` and `/health`

Recommended operational checks:

- confirm Mongo connectivity before rollout
- confirm `/health` returns `status: ok`
- confirm at least one admin user exists
- confirm frontend `VITE_API_BASE_URL` points to this backend base URL, not directly to `/graphql`

## Troubleshooting

### Server starts but exits after Mongo retries

Cause:
- `MONGO_URI` is wrong or MongoDB is unreachable

Fix:
- verify network access, credentials, and the configured database URI

### Frontend gets CORS errors in production

Cause:
- current production CORS setup blocks cross-origin browser requests by default

Fix:
- host frontend and backend on the same origin, or update backend CORS policy before deployment

### API keys fail unexpectedly

Cause:
- invalid key, expired key, inactive key, wrong application, or missing `ENCRYPTION_KEY`

Fix:
- verify key status and application scope
- confirm the environment uses the expected encryption key

### Upload or documentation flows fail

Cause:
- missing or invalid AWS credentials, region, or bucket configuration

Fix:
- verify `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET`

## Notes For Maintainers

- This service is GraphQL-first even though some legacy REST auth code remains in the repo
- Date serialization is normalized server-side before GraphQL responses are returned
- Translation seeding is intentionally separated from main data seeding
- Public embed access is designed around API keys, not login state
