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
- **Lightweight authentication** — a shared-password login gate implemented
  with HMAC-signed cookies verified via the Web Crypto API, running entirely
  in Next.js Edge Middleware (no database session table, no third-party auth
  provider).

## Notable Engineering Details

- **Edge-compatible session signing**: session tokens are created and
  verified using the native `crypto.subtle` API rather than a Node.js-only
  library, so the same code runs correctly in Vercel's Edge Runtime for
  middleware.
- **Internal API calls bypass edge auth by design**: Server Components fetch
  data from the app's own API routes during rendering; since those requests
  don't carry the browser's cookies, the middleware intentionally scopes
  authentication to page routes rather than the API layer, avoiding a broken
  data-fetching pattern.
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
  page.tsx                    Dashboard
  login/                      Login screen
  team-leaders/                List + detail (buildings & cleaners per building)
  buildings/                   List (create/rename/delete) + detail (staff, slots, hours, WO)
  filter/                      Search by building, name, or staff number
  staff/new, staff/[id]/edit   Staff create/edit
  timesheets/                  Team leader list -> generates the printable sheet
  api/                         REST route handlers (staff, buildings, team-leaders, slots, auth)

components/                    UI components (forms, cards, staff rows, logout, etc.)
lib/                           Prisma client, session signing, DTO types, Zod validation
middleware.ts                  Route protection (Edge Runtime)
prisma/                        Schema + manual migration history

## Getting Started
''bash 
# PostgreSQL (Neon) — pooled connection, used by the app at runtime
DATABASE_URL=

# PostgreSQL (Neon) — direct connection, used for migrations
DIRECT_URL=

# Shared password required to log in to the app
APP_PASSWORD=

# Random secret used to sign the session cookie (generate with:
# python3 -c "import secrets; print(secrets.token_hex(32))")
AUTH_SECRET=


