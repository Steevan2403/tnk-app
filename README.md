# TNK Property Services

Building management for TNK Property Services. This app replaces the subscribed product the team was using. Feature 1 covers sign-in, the app shell, and buildings. Feature 2 covers contractors: companies, contacts, notes, documents, and insurance.

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

## Local development accounts

These credentials are for the seeded local database only.

Admin, who can manage buildings and contractors:

- Email: `admin@tnk.example`
- Password: `example-admin-pass`
- Role: `admin`

Staff, who can view contractors but cannot add or change them:

- Email: `staff@tnk.example`
- Password: `example-staff-pass`
- Role: `staff`

Roles are `admin`, `manager`, and `staff`. Every page except sign-in requires a signed-in user. Only an admin can create or edit buildings. An admin or a manager can create, edit, approve, and delete contractors. The selected building is stored on the user and scopes the dashboard.

The seed also creates two buildings: Example Tower (Sydney) and Sample Court (Pyrmont). It creates example contractor companies, including Sample Plumbing Co with expired insurance and Demo Locksmith waiting for approval.

Uploaded contractor documents and insurance certificates are stored in the local `uploads/` directory.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run test:e2e` — Playwright end-to-end tests (installs nothing by itself; see below)
- `npm run db:migrate` — apply migrations
- `npm run db:seed` — seed the local accounts, example buildings, and example contractors

## End-to-end test

Install the browser once, then run the smoke test. It needs the `.env` file from the setup above.

```bash
npx playwright install chromium
npm run test:e2e
```

The smoke test signs in, creates a building, switches to it, and checks the dashboard. The contractors test creates a company with a contact and an expired insurance, then checks that the staff account cannot add a company. Both use their own database file (`prisma/e2e.db`) and do not change `prisma/dev.db`.
