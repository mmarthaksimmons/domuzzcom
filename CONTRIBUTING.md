# Contributing

Thanks for your interest in improving Domuzz! This document covers how to get a
local environment running and what we look for in a pull request.

## Getting set up

1. **Fork and clone**

   ```bash
   git clone https://github.com/<your-username>/domuzzcom.git
   cd domuzzcom
   ```

2. **Install dependencies** (Node.js 20+ is required)

   ```bash
   npm install
   ```

   `npm install` also runs `prisma generate` via the `postinstall` script.

3. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Only `DATABASE_URL` and `APIFY_TOKEN` are needed for the core flows.
   `GEMINI_API`, `GOOGLE_MAPS_API_KEY` and `RESEND_API_KEY` are optional —
   the app degrades gracefully when they are missing. See `.env.example` for
   the full list.

   Any Postgres database works; [Neon](https://neon.tech) has a generous free
   tier and matches what we use in production.

4. **Create the database tables**

   ```bash
   npx prisma db push
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   The app is served at http://localhost:3000.

## Useful commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the Next.js dev server                  |
| `npm run build`     | `prisma generate` + production build          |
| `npm start`         | Serve the production build                    |
| `npm run lint`      | Run ESLint                                    |
| `npx tsc --noEmit`  | Type-check without emitting output            |
| `npx prisma studio` | Inspect the local database                    |

## Project layout

```
app/            Next.js App Router pages and API routes
  api/          Route handlers (compare, cma, lead)
  cma/          CMA report pages (public permalink + print view)
  compare/      Property comparison flow
  fsbo/         FSBO savings calculator
components/     React components (ui/ holds shadcn primitives)
lib/            Server-side logic: scraping, AI, valuation, PDF, prisma
prisma/         Prisma schema
docs/           Longer-form design/deployment notes
```

Note: this repo targets **Next.js 16 / React 19**, which has breaking changes
relative to older versions. Check the bundled docs under
`node_modules/next/dist/docs/` before using an API you remember from Next 13/14.

## Making a change

1. Create a branch: `git checkout -b fix/short-description`
2. Keep commits focused and write imperative commit subjects
   (e.g. `fix: guard against missing CMA report slug`).
3. If you touch TypeScript, make sure `npm run lint` and `npx tsc --noEmit`
   pass, and that `npm run build` still succeeds.
4. If you change behaviour that depends on an env var, update `.env.example`
   and the README.
5. Open a pull request against `main` and describe the problem, the change, and
   how you verified it. Screenshots are welcome for UI changes.

## Coding conventions

- TypeScript everywhere; prefer explicit types on exported functions.
- Server-only logic stays in `lib/` and is imported from route handlers, not
  from client components.
- UI primitives live in `components/ui/` and follow
  [shadcn/ui](https://ui.shadcn.com) conventions; compose them rather than
  writing bespoke equivalents.
- Never hardcode credentials — read them from `process.env`.
- Treat scraped listing data as untrusted input; normalise it in `lib/normalize.ts`.

## Reporting bugs and requesting features

Use the issue templates. For anything security related, follow
[SECURITY.md](./SECURITY.md) instead of opening a public issue.

## License

By contributing you agree that your contributions are licensed under the terms
of this repository's license (see [LICENSE](./LICENSE)).
