# TNK Property Services

Building management for TNK Property Services. This app replaces the subscribed product the team was using. Feature 1 covers sign-in, the app shell, and buildings. Feature 2 covers contractors: companies, contacts, notes, documents, and insurance. Feature 3 covers apartments and residents for the selected building. Feature 4 covers the asset register for the selected building. Feature 5 covers cases for the selected building.

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

Admin, who can manage buildings, contractors, apartments, residents, assets, asset categories, cases, and case types:

- Email: `admin@tnk.example`
- Password: `example-admin-pass`
- Role: `admin`

Staff, who can view contractors, residents, and assets, and can add apartment notes. Staff can create and edit cases, change status, comment, and upload files, but cannot delete a case or its files, and cannot add or change other records:

- Email: `staff@tnk.example`
- Password: `example-staff-pass`
- Role: `staff`

Roles are `admin`, `manager`, and `staff`. Every page except sign-in requires a signed-in user. Only an admin can create or edit buildings. An admin or a manager can create, edit, approve, and delete contractors. An admin or a manager can create, edit, and delete apartments, residents, vehicles, documents, and images. Staff can view those records and add notes. An admin or a manager can create, edit, and delete assets, photos, documents, and warranties. Only an admin can add, rename, or remove asset categories, and a category can be removed only when no asset uses it. An admin, a manager, or a staff member can create and edit cases, change status, comment, and upload photos, videos, quotes, invoices, and documents. An admin or a manager can delete a case and its files. Only an admin can add, rename, or remove case types, and a type can be removed only when no case uses it. Case descriptions are stored as sanitised HTML. The selected building is stored on the user and scopes the dashboard, apartments, residents, assets, and cases. Asset categories, case types, and contractors belong to the account.

The seed also creates two buildings: Example Tower (Sydney) and Sample Court (Pyrmont). It creates example contractor companies, including Sample Plumbing Co with expired insurance and Demo Locksmith waiting for approval. Example Tower has apartments 101–104, 201–204, and 301–304, fifteen example residents, two vehicles (EXA-001 and EXA-002), and apartment 104 marked as an investment with Example Holdings and Sample Strata Management. Example Tower also has ten example assets, including Fire pump 1 with an expired warranty and Passenger lift A with a warranty still in date. Example Tower has fifteen example cases across the case types, priorities, and statuses. Two of them are overdue. Some are linked to the example assets, apartments, and contractors.

Uploaded contractor, resident, asset, and case files are stored in the local `uploads/` directory.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run test:e2e` — Playwright end-to-end tests (installs nothing by itself; see below)
- `npm run db:migrate` — apply migrations
- `npm run db:seed` — seed the local accounts, example buildings, example contractors, example apartments, example assets, and example cases

## End-to-end test

Install the browser once, then run the smoke test. It needs the `.env` file from the setup above.

```bash
npx playwright install chromium
npm run test:e2e
```

The smoke test signs in, creates a building, switches to it, and checks the dashboard. The contractors test creates a company with a contact and an expired insurance, then checks that the staff account cannot add a company. The residents test creates an apartment, adds a resident, a vehicle, and a document, then checks that the staff account cannot add a resident. The assets test creates an asset with a service company and contact, adds an expired warranty, opens the QR label, and checks that the staff account cannot add an asset. The cases test creates a case linked to an asset and a contractor, changes its status on the board, adds a comment and a photo, checks the asset page, and checks that the staff account cannot delete the case. All five use their own database file (`prisma/e2e.db`) and do not change `prisma/dev.db`.
