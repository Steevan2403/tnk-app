# TNK Property Services

Building management for TNK Property Services. This app replaces the subscribed product the team was using. Feature 1 covers sign-in, the app shell, and buildings.

## Requirements

- Node.js 22
- npm

## Local setup

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

Open http://localhost:3000.

`npx prisma migrate dev` is for creating a new migration after a schema change. `migrate deploy` applies the migrations already in the repo.

The database is SQLite (`prisma/dev.db`). The Prisma schema uses types that PostgreSQL supports as well. To move off SQLite, set the datasource provider to `postgresql` and point `DATABASE_URL` at that database.

`.env.example` holds local development values only. Generate a new `AUTH_SECRET` before using this app anywhere else.

## Local development account

These credentials are for the seeded local database only:

- Email: `admin@tnk.example`
- Password: `example-admin-pass`

The account role is `admin`. Roles are `admin`, `manager`, and `staff`. Every page except sign-in requires a signed-in user. Only an admin can create or edit buildings. The selected building is stored on the user and scopes the dashboard.

The seed also creates two buildings: Example Tower (Sydney) and Sample Court (Pyrmont).

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run test:e2e` — Playwright smoke test (installs nothing by itself; see below)
- `npm run db:migrate` — apply migrations
- `npm run db:seed` — seed the local admin and example buildings

## End-to-end test

Install the browser once, then run the smoke test. It needs the `.env` file from the setup above.

```bash
npx playwright install chromium
npm run test:e2e
```

The test signs in, creates a building, switches to it, and checks the dashboard. It uses its own database file (`prisma/e2e.db`) and does not change `prisma/dev.db`.
