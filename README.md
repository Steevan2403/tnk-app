# TNK Property Services

Building management for TNK Property Services. This app replaces the subscribed product the team was using. Feature 1 covers sign-in, the app shell, and buildings. Feature 2 covers contractors: companies, contacts, notes, documents, and insurance. Feature 3 covers apartments and residents for the selected building. Feature 4 covers the asset register for the selected building. Feature 5 covers cases for the selected building. Feature 6 covers work orders sent from a case to a contractor. Feature 7 covers the maintenance schedule and calendar.

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

Admin, who can manage buildings, contractors, apartments, residents, assets, asset categories, cases, case types, and maintenance:

- Email: `admin@tnk.example`
- Password: `example-admin-pass`
- Role: `admin`

Staff, who can view contractors, residents, assets, and maintenance, and can add apartment notes. Staff can create and edit cases, change status, comment, and upload files. Staff can mark a maintenance visit completed or skipped and open a case from one, but cannot delete a case or its files, and cannot add or change the maintenance schedule:

- Email: `staff@tnk.example`
- Password: `example-staff-pass`
- Role: `staff`

Roles are `admin`, `manager`, and `staff`. Every page except sign-in requires a signed-in user. Only an admin can create or edit buildings. An admin or a manager can create, edit, approve, and delete contractors. An admin or a manager can create, edit, and delete apartments, residents, vehicles, documents, and images. Staff can view those records and add notes. An admin or a manager can create, edit, and delete assets, photos, documents, and warranties. Only an admin can add, rename, or remove asset categories, and a category can be removed only when no asset uses it. An admin, a manager, or a staff member can create and edit cases, change status, comment, and upload photos, videos, quotes, invoices, and documents. An admin or a manager can delete a case and its files. Only an admin can add, rename, or remove case types, and a type can be removed only when no case uses it. Case descriptions are stored as sanitised HTML. An admin, a manager, or a staff member can send a work order and change its status. Only an admin or a manager can cancel a work order. Completing work orders does not close the case. Only an admin can open the outbox. An admin or a manager can create and edit maintenance. An admin, a manager, or a staff member can mark a visit completed or skipped and create a case from one. The selected building is stored on the user and scopes the dashboard, apartments, residents, assets, cases, work orders, maintenance, and the calendar. Asset categories, case types, and contractors belong to the account. Dates are calendar days in Australia/Sydney.

The seed also creates two buildings: Example Tower (Sydney) and Sample Court (Pyrmont). It creates example contractor companies, including Sample Plumbing Co with expired insurance and Demo Locksmith waiting for approval. Example Tower has apartments 101–104, 201–204, and 301–304, fifteen example residents, two vehicles (EXA-001 and EXA-002), and apartment 104 marked as an investment with Example Holdings and Sample Strata Management. Example Tower also has ten example assets, including Fire pump 1 with an expired warranty and Passenger lift A with a warranty still in date. Example Tower has fifteen example cases across the case types, priorities, and statuses. Two of them are overdue. Some are linked to the example assets, apartments, and contractors. Example Tower also has six example work orders. Case 1 has 1-A and 1-B. The others are on cases 4, 8, 11, and 14, in different statuses. Each one has a PDF and a matching outbox message. Example Tower also has eight example maintenance events, including a monthly fire system test, a monthly lift service with overdue visits, and a completed one-off camera check.

Uploaded contractor, resident, asset, and case files are stored in the local `uploads/` directory.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — unit tests
- `npm run test:e2e` — Playwright end-to-end tests (installs nothing by itself; see below)
- `npm run db:migrate` — apply migrations
- `npm run db:seed` — seed the local accounts, example buildings, example contractors, example apartments, example assets, example cases, example work orders, and example maintenance
- `npm run reminders` — queue maintenance reminder emails that are due into the local outbox

## End-to-end test

Install the browser once, then run the smoke test. It needs the `.env` file from the setup above.

```bash
npx playwright install chromium
npm run test:e2e
```

The smoke test signs in, creates a building, switches to it, and checks the dashboard. The contractors test creates a company with a contact and an expired insurance, then checks that the staff account cannot add a company. The residents test creates an apartment, adds a resident, a vehicle, and a document, then checks that the staff account cannot add a resident. The assets test creates an asset with a service company and contact, adds an expired warranty, opens the QR label, and checks that the staff account cannot add an asset. The cases test creates a case linked to an asset and a contractor, changes its status on the board, adds a comment and a photo, checks the asset page, and checks that the staff account cannot delete the case. The work orders test sends a work order from a case, checks the work-orders list, opens the PDF, and checks the outbox. The maintenance test creates a monthly event, checks the overdue tab and the calendar, marks a visit complete, and opens a case from an overdue visit. All of them use their own database file (`prisma/e2e.db`) and do not change `prisma/dev.db`.

## Email

Outgoing mail stays in this app. There is no paid mail service and no real inbox. Each message is stored in the local outbox, including the attachment names, and an admin can read it at `/settings/outbox`.

SMTP is off unless you set it. To point the same helper at an SMTP server later, set these variables. Do not commit passwords or other credentials.

```bash
MAIL_TRANSPORT=smtp
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=work-orders@example.com
```

`MAIL_TRANSPORT` must be `smtp`, and both `SMTP_HOST` and `SMTP_FROM` must be set. Otherwise every message stays in the outbox. The SMTP adapter uses nodemailer. Leave the variables unset for local development and tests.

## Maintenance reminders

Maintenance visits are calculated from the schedule. Completed and skipped visits are stored. Reminder emails are not sent on a timer.

`npm run reminders` checks the local database and queues a reminder into the outbox for each visit due in the event's lead time (7 days unless the event says otherwise). Running it again does not queue a second email for the same visit.

The same check is available as `POST /api/cron/reminders`. Set `CRON_SECRET` and send it as `Authorization: Bearer <secret>`. This app does not start a scheduler and does not call a paid service. A server cron entry can call that route later if you want it to run on a clock.
