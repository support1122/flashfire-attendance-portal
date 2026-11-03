# Flashfire Attendance

Attendance and leave for the Flashfire team.
Next.js 16 app with its API in route handlers, MongoDB through Mongoose, deployed as one Vercel project.

## What it does

- Employees sign in with an emailed 6-digit code, check in and out, see their month, and request leave.
- Admins approve or reject leave, mark each approved leave paid or unpaid, correct any day, and export the month as CSV.
- Anyone at an allowed domain (`flashfirehq.com` by default) can sign in. Admins can allow more domains and add outside emails.
- `DEFAULT_ADMIN_EMAIL` can also sign in with a password, from the same login page. Admins land on `/admin`, everyone else on `/`.
- Active CRM admins (from the CRM database named by `CRM_DB_NAME`) become admins here when they sign in.
- Leave emails go out over SMTP after the response is sent, so a mail failure never blocks the action:
  - New request or withdrawal: every active admin except the employee.
  - Approve, reject, revoke, or a paid/unpaid change: the employee, plus a copy to every other active admin. The admin who acted is skipped.

## Run it locally

```bash
cp .env.example .env.local   # then fill it in
npm install
npm run dev
```

Check `.env.local` before running: if `MONGODB_URI` points at the production cluster, local actions write real data (into `MONGODB_DB`, which must stay `flashfire_attendance`, never `test`).
Leave `SMTP_USER` empty locally to print login codes to the terminal instead of emailing them.

## Checks

```bash
npm run typecheck
npm run lint
npm test          # API flows against an in-memory MongoDB, no network needed
npm run build
```

## Rules worth knowing

- Every day is an IST calendar day (`YYYY-MM-DD`).
- Check-out follows the open shift for up to 20 hours, so a 9 pm to 5 am shift closes on the day it started.
- Day status precedence: admin override, then approved leave, then check-in, then weekly off or holiday, then absent.
- Leave day counts skip weekly offs and holidays and are frozen when the request is made.
- An admin can't decide their own leave unless they are the only active admin.
- Built-in admins (`ADMIN_EMAILS`, `DEFAULT_ADMIN_EMAIL`) can't be demoted or turned off from the app.
- Turning a person off signs them out of every device at once.

## Deploy on Vercel

1. Import the repo as a Vercel project (framework preset: Next.js, no custom build command).
2. Add every variable from `.env.example` in Project Settings, Environment Variables.
3. In MongoDB Atlas, allow Vercel to reach the cluster (Network Access).
