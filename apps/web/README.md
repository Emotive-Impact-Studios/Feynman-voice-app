# Fenny website

One static page (`index.html`, built from the v3 design) and one function (`api/waitlist.ts`) that saves emails to Neon.

## Deploy

1. In Vercel, add a new project from this repo with **Root Directory** `apps/web` and framework preset **Other**.
2. Add `DATABASE_URL` (the Neon `feynman` database connection string) to the project.
3. Run `schema.sql` once on that database.
4. Add the domain (for example fenny.app) under the project's Domains.

## Preview locally

`npx serve apps/web` shows the page. The waitlist form needs the function, so use `vercel dev` from `apps/web` to try it end to end.
