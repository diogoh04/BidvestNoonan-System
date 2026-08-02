# Bidvest Noonan — Staff Management System

A full-stack internal tool built to digitize workforce management for a
facilities services team: staff records, building assignments, shift
allocation, and printable timesheets — replacing a manual, spreadsheet-based
process with a live, database-backed system used daily by real staff.

**Live workflow it replaced:** managers previously tracked cleaners, team
leaders, building assignments, and weekly sign-in/sign-out sheets across
scattered spreadsheets. This app centralizes all of it, with print-ready
output that matches the company's existing paper timesheet format.

## Tech Stack

- **Framework:** Next.js 14 (App Router, Server Components, Route Handlers)
- **Language:** TypeScript
- **Database:** PostgreSQL (Neon, serverless) via Prisma ORM
- **Styling:** Tailwind CSS
- **Auth:** Custom Edge-compatible signed-cookie session (no external auth library)
- **Hosting:** Vercel

## Key Features

- **Staff & building management** — full CRUD for cleaners and team leaders,
  with a many-to-many relationship to buildings (a person can work across
  multiple sites, and a site can have multiple people assigned).
- **Per-relationship attributes** — weekly hours are stored per
  staff-building pair, not just per staff member, so the same person can have
  different contracted hours at different sites.
- **Vacancy tracking** — buildings can define fixed "slots" (a position with
  a set number of hours) independent of who currently fills it, with unfilled
  slots surfaced visually as open vacancies.
- **Print-accurate timesheet generation** — generates a two-page (front and
  back), landscape A4 sign-in/sign-out sheet per team leader, dynamically
  scaling font size and row height based on staff count so the layout always
  fits on a single printed page front, regardless of how many people are
  assigned.
- **Role-based access (Master / Supervisor / Team Leader)** — per-user login
  accounts (username + bcrypt-hashed password) instead of a single shared
  password, with HMAC-signed session cookies carrying the user's id and role,
  verified via the Web Crypto API. Master keeps full access plus per-building
  hour-balance control and a user-management screen; Supervisor reviews
  submitted timesheets and marks them done; Team Leader only sees their own
  buildings and a digital timesheet flow.
- **Digital timesheet workflow** — Team Leaders fill in real sign-in/sign-out
  data per employee per week on screen (persisted in Postgres as a JSON
  snapshot of that week's roster), submit it, and Supervisors mark it as
  concluded. The original print-only "Sign In & Sign Out Book" flow remains
  available to Master as a blank-template utility.

## Notable Engineering Details

- **Edge-compatible session signing**: session tokens are created and
  verified using the native `crypto.subtle` API rather than a Node.js-only
  library, so the same code runs correctly in Vercel's Edge Runtime for
  middleware.
- **Internal API calls bypass edge middleware by design, but not
  authorization**: Server Components fetch data from the app's own API
  routes during rendering, so those internal fetches explicitly forward the
  `cookie` header; middleware still only does coarse, role-based page
  redirects (cheap, no DB/bcrypt work, Edge-safe), while every Route Handler
  independently checks the caller's role (and, for Team Leaders, building
  ownership) via `lib/auth.ts` — the real authorization boundary lives at the
  API layer, not just the page layer.
- **Adaptive print layout**: rather than a fixed-size table that overflows
  onto extra pages for larger buildings, cell padding, row height, and font
  size scale down in steps based on row count, so a 3-person building and a
  30-person building both render legibly on one page.
- **Static-route caching pitfall avoided**: Next.js can silently optimize
  parameterless `GET` route handlers as static at build time. Routes that
  must always reflect live data are explicitly marked
  `export const dynamic = "force-dynamic"` to prevent serving stale results
  in production.


## Project Structure
app/
  page.tsx                    Role-filtered home hub (Master/Supervisor/Team Leader)
  login/                      Login screen (username + password)
  team-leaders/                List + detail (buildings & cleaners per building) — Master
  buildings/                   List (create/rename/delete) + detail (staff, slots, hours, WO) — Master
  filter/                      Search by building, name, or staff number — Master
  staff/new, staff/[id]/edit   Staff create/edit — Master
  timesheets/                  Print-only blank sheet generator — Master
  my/                          Team Leader's own buildings + digital timesheet editor
  review/                      Supervisor's submitted-timesheets queue + mark-as-done
  users/                       Master's user account management (create/edit/deactivate)
  api/                         REST route handlers (staff, buildings, team-leaders, timesheets, users, auth)

components/                    UI components (forms, cards, staff rows, logout, etc.)
components/timesheets/         Digital timesheet editor (shared by Team Leader fill-in and Supervisor review)
lib/                           Prisma client, session signing, DTO types, Zod validation, auth helpers
scripts/seed-user.ts           One-off CLI to create/update a login account (bcrypt hash, no SQL editor support)
middleware.ts                  Coarse role-based page routing (Edge Runtime)
prisma/                        Schema + manual migration history

## Getting Started
```bash
# PostgreSQL (Neon) — pooled connection, used by the app at runtime
DATABASE_URL=

# PostgreSQL (Neon) — direct connection, used for migrations
DIRECT_URL=

# Random secret used to sign the session cookie (generate with:
# python3 -c "import secrets; print(secrets.token_hex(32))")
AUTH_SECRET=
```

After running `prisma/manual-migration-7.sql` against the database, create
the first login account with:

```bash
npx tsx scripts/seed-user.ts <username> <password> master
```


