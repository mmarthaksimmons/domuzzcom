# Domuzz

[![CI](https://github.com/mmarthaksimmons/domuzzcom/actions/workflows/ci.yml/badge.svg)](https://github.com/mmarthaksimmons/domuzzcom/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

Free, no-signup real-estate tools for home buyers and sellers. Everything runs
server-side next to the data; there is no account system and no user database
beyond an optional email capture.

## What's inside

| Tool | Route | Description |
| --- | --- | --- |
| Property comparison | `/compare` | Compare up to 3 listings side by side — price, taxes, schools, big-ticket repairs — with an AI summary and CSV export. |
| CMA report | `/cma` | Generate a Comparative Market Analysis for any US address: valuation estimate, recent comps, charts, a map and a printable/shareable PDF report at `/cma/[slug]`. |
| FSBO calculator | `/fsbo` | Model commission savings and net proceeds when selling without an agent. |

## Tech stack

- **Framework** — Next.js 16 (App Router) + React 19, TypeScript
- **Styling/UI** — Tailwind CSS v4, shadcn/ui primitives, lucide-react icons
- **Data** — Prisma 7 with the Neon serverless Postgres adapter
- **Charts/maps** — Recharts, Leaflet
- **PDF** — `@react-pdf/renderer` (plus an optional headless-Chromium path, see `docs/`)
- **AI** — Google Gemini (`@google/generative-ai`)
- **Listing data** — Apify Zillow actors (detail + zip search)
- **Email** — Resend
- **Analytics** — Vercel Analytics + GA4

## Getting started

Requires **Node.js 20+**.

```bash
git clone https://github.com/mmarthaksimmons/domuzzcom.git
cd domuzzcom
npm install                 # also runs `prisma generate`
cp .env.example .env.local  # then fill in your own values
npx prisma db push          # create tables in your Postgres database
npm run dev                 # http://localhost:3000
```

### Environment variables

Only the first two are required; every optional integration degrades
gracefully when its key is missing.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Postgres connection string (Neon works well; the adapter is serverless-only). |
| `APIFY_TOKEN` | ✅ | Runs the Zillow scraping actors for listing data. |
| `NEXT_PUBLIC_SITE_URL` | – | Your public origin, used for sitemap, canonical/OG URLs and email links. Defaults to `https://www.domuzz.com`. |
| `NEXT_PUBLIC_SITE_NAME` | – | Product name in titles/OG metadata. Defaults to `Domuzz`. |
| `GEMINI_API` | – | AI summaries and CMA analysis. Without it, deterministic output is used. |
| `GOOGLE_MAPS_API_KEY` | – | Street View photos (Street View Static API). Falls back to listing photos. |
| `RESEND_API_KEY` | – | Report emails and lead sync. |
| `RESEND_FROM_EMAIL` | – | "From" address for those emails. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | – | Your own GA4 property. **No default** — leave unset and no analytics tag loads. |
| `CMA_RATE_LIMIT_MAX` / `CMA_RATE_LIMIT_WINDOW_MINUTES` | – | Per-IP CMA limit (default 5 / 60 min). |
| `DISABLE_RATE_LIMIT` | – | Set to `true` to turn rate limiting off. |

Note: `lib/prisma.ts` uses `@prisma/adapter-neon`, so `DATABASE_URL` must point
at a serverless-capable Postgres endpoint (Neon, or the Neon-compatible
Postgres offered by most providers).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check |
| `npx prisma studio` | Browse the local database |

## Project structure

```
app/
  api/            Route handlers — compare, compare/stream, cma, cma/analysis, cma/report, lead
  cma/            CMA flow: form, public permalink (/cma/[slug]) and print view
  compare/        Comparison flow and results
  fsbo/           FSBO savings calculator
components/       UI components; components/ui holds the shadcn primitives
lib/              Server logic — apify (scraping), cma (valuation), ai/gemini, mortgage,
                  systems (big-ticket estimates), normalize, rate-limit, prisma, pdf
prisma/           Prisma schema (Lead, CmaReport)
docs/             Long-form design notes and deployment guides
scripts/          One-off maintenance scripts
```

> **Heads-up:** this project targets Next.js 16, which contains breaking changes
> versus Next 13/14. The bundled docs live in `node_modules/next/dist/docs/`.

## Deployment

This is a standard Next.js deployment and expects a managed Postgres instance
(Neon) plus the environment variables above — for example on Vercel: import the
repo, add the env vars, and run `npx prisma db push` against your database once.
`docs/PIXEL_PERFECT_PDF_LIGHTSAIL.md` documents an optional self-hosted
Chromium service for pixel-perfect PDF rendering.

## A note on data sources

Listing data is retrieved through third-party scrapers (Apify Zillow actors). If
you self-host this, you are responsible for complying with those providers'
terms of service, their rate limits, and any applicable law in your
jurisdiction. Nothing here is a substitute for a professional appraisal or
financial advice.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md). Please report security issues
privately per [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Marthak Simmons
