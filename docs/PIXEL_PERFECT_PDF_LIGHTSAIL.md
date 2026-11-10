# Pixel‑Perfect PDF Generation on Amazon Lightsail (Vercel + Lightsail Hybrid)

> **Reference architecture, not a requirement.** This document describes one
> optional way to render pixel-perfect PDFs for a self-hosted deployment,
> written against the Domuzz production setup. Nothing here is wired into the
> app by default — the shipped PDF path uses `@react-pdf/renderer`
> (`lib/CmaPdfDocument.tsx`). Adapt the hostnames, instance sizes and costs to
> your own infrastructure. **No real credentials appear in this file**; every
> secret is read from the environment (`PDF_SERVICE_TOKEN`).

This guide covers how to produce **pixel‑perfect CMA reports as PDFs** from the Domuzz Next.js app, with:

- **domuzz.com** staying on **Vercel** (hosting the Next.js app, APIs, and database)
- **Amazon Lightsail** running a dedicated **PDF microservice** (Puppeteer + Chromium) that Vercel calls when it needs to generate a server‑side PDF

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How PDFs Are Generated Today](#2-how-pdfs-are-generated-today)
3. [Why a Dedicated PDF Microservice?](#3-why-a-dedicated-pdf-microservice)
4. [Achieving Pixel‑Perfect Output](#4-achieving-pixel-perfect-output)
5. [Lightsail PDF Microservice Setup](#5-lightsail-pdf-microservice-setup)
6. [Connecting Vercel to Lightsail](#6-connecting-vercel-to-lightsail)
7. [Verifying PDF Fidelity](#7-verifying-pdf-fidelity)
8. [Checklist](#8-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────────────┐
│       Vercel        │         │     Amazon Lightsail VM      │
│                     │  HTTP   │                             │
│  domuzz.com         │────────▶│  PDF Microservice           │
│  (Next.js 16)       │◀────────│  (Express + Puppeteer +     │
│                     │  PDF    │   Chromium)                 │
│  - CMA UI           │         │                             │
│  - Compare UI       │         │  Port 3001 (internal)       │
│  - All other APIs   │         │  Caddy reverse proxy :443   │
│  - Prisma/DB via    │         │                             │
│    Vercel Postgres  │         │  bash                         │
│    or Supabase      │         │  /api/pdf/render  ← accepts  │
│                     │         │    HTML, returns PDF Buffer  │
└─────────────────────┘         └─────────────────────────────┘
```

- **Vercel** hosts the full Next.js application and all its API routes.
- **Lightsail** runs a **tiny Node.js server** whose only job is to accept an HTML string, spawn a headless Chromium via Puppeteer, and return a pixel‑perfect PDF.
- Vercel’s `/api/cma/pdf` route (or a `cma.ts` service function) sends the pre‑rendered HTML to the Lightsail microservice and streams the PDF back to the user, or attaches it to an email via Resend.

---

## 2. How PDFs Are Generated Today

The app has two independent PDF paths. Both must produce visually identical output.

### 2.1 Server‑Side PDF (`@react-pdf/renderer`)

| File | Role |
|---|---|
| `lib/CmaPdfDocument.tsx` | Declarative PDF layout using JSX primitives (`<Document>`, `<Page>`, `<View>`, `<Text>`) |
| **Not yet exposed via API** | This component exists but is **not wired** to an `/api/cma/pdf` route yet |

**Key characteristics:**

- Runs **entirely on the server** (`@react-pdf/renderer` v4.5.1).
- Uses **explicit styles** (`StyleSheet.create`) — no Tailwind, no CSS cascade.
- Font: **Inter** loaded from Google Fonts CDN at registration time (see `Font.register`).
- Output: a raw PDF `Buffer` that can be returned as `application/pdf`.

### 2.2 Client‑Side Browser Print

| File | Role |
|---|---|
| `app/cma/print/page.tsx` | Receives serialised report data via `sessionStorage`, renders React components, triggers `window.print()` |

**Key characteristics:**

- Renders the **same components** used on‑screen (`CmaReport`, `CmaMap`, `CmaCharts`, `CmaAiAnalysis`, `RenovationAdjustments`).
- Uses **Tailwind classes** + `print:` variants for print‑only styling (e.g. `print:p-0`, `print:break-inside-avoid`).
- Relies on the browser’s built‑in **Save as PDF** / **Print to PDF** flow.

### 2.3 Why Two Rendering Paths?

| Path | When to use |
|---|---|
| **`@react-pdf/renderer` or Puppeteer PDF** | Automated email attachments, programmatic generation, server‑side pipelines |
| **`window.print()`** | Ad‑hoc user downloads, quick sharing from the browser |

A pixel‑perfect setup means both paths produce the **same page dimensions, same typography, same colours, same table layout**.

---

## 3. Why a Dedicated PDF Microservice?

Vercel serverless functions have **hard limits** that make Puppeteer impractical:

| Limitation | Vercel Pro | Why it fails |
|---|---|---|
| **Max duration** | 60 s (Pro), 900 s (Enterprise) | Chromium cold start + page render can exceed 10–15 s |
| **Max memory** | 1024 MB (Hobby), 3008 MB (Pro) | Chromium alone uses ~500 MB idle |
| **Binary size** | 250 MB uncompressed limit | Chromium binary is ~300 MB |
| **Ephemeral disk** | `/tmp` only, wiped per invocation | Chromium’s `--user-data-dir` and profile need persistent storage |
| **No `apt install`** | Cannot install system deps | Chromium needs `libnss3`, `libatk`, `libcups`, etc. |

**Solution**: A cheap Lightsail VM ($10–20/mo) running a tiny HTTP service that:
1. Receives an HTML payload.
2. Renders it with headless Chromium via Puppeteer.
3. Returns the PDF `Buffer`.

This keeps Vercel handling all business logic and the Lightsail instance acting as a pure rendering sidecar.

---

## 4. Achieving Pixel‑Perfect Output

The golden rules for deterministic, print‑ready PDFs:

### 4.1 Fixed Page Size & Margins

Always use **explicit dimensions**. Never rely on `auto` or viewport‑based units.

- **In `@react-pdf/renderer`**: `<Page size="LETTER">` (8.5 × 11 in) with `padding: 36` (½ inch).
- **For Puppeteer / browser print**:

```css
/* In app/globals.css or a print-specific stylesheet */
@media print {
  @page {
    size: letter;
    margin: 0.5in;
  }
  body {
    width: 7.5in;   /* 8.5 − 2×0.5 */
    margin: 0 auto;
  }
}
```

And in the Puppeteer `page.pdf()` call:

```ts
const pdf = await page.pdf({
  format: "Letter",
  margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
  printBackground: true,
  preferCSSPageSize: true,
});
```

### 4.2 Embedded Fonts (Not System Fonts)

System fonts differ between Linux / macOS / Windows and between browsers. This is the **#1 cause of layout drift** in PDFs.

#### For `@react-pdf/renderer`
Fonts are already registered in `lib/CmaPdfDocument.tsx` via Google Fonts CDN. This is good, but the CDN is an **external network call** every time the PDF renders.

**Better: bundle the font locally.**

1. Download the Inter `.ttf` files to `public/fonts/inter-regular.ttf` and `public/fonts/inter-bold.ttf`.
2. Reference them locally:

```ts
Font.register({
  family: "Inter",
  fonts: [
    { src: `${process.cwd()}/public/fonts/inter-regular.ttf`, fontWeight: 400 },
    { src: `${process.cwd()}/public/fonts/inter-bold.ttf`, fontWeight: 700 },
  ],
});
```

> `@react-pdf/renderer` resolves local file paths from the Node process working directory.

#### For Puppeteer (Lightsail Microservice)
Include Inter via a `<link>` or `@font-face` in the HTML you send to the microservice so Chromium renders with Inter, not a fallback.

### 4.3 Explicit, Non‑Collapsing Sizes

| Do | Don’t |
|---|---|
| Fixed column widths (`flex: 2.5`, `minWidth`) | `width: auto` |
| `fontSize` in `pt` or explicit numeric `px`-like units | `rem` / `em` in PDF context |
| A table with explicit widths per column | A `display: grid` with fractional units that may reflow |

The `CmaPdfDocument.tsx` already does this well — see `colAddr`, `colPrice` etc. with fixed flex ratios.

### 4.4 Colour Consistency

- **`@react-pdf/renderer`** uses a subset of CSS colour support. Always use hex colours (`#1a1a1a`).
- **Puppeteer**: Use `printBackground: true` in the PDF options, and in your CSS:

```css
@media print {
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### 4.5 Page Breaks

- **Puppeteer**: Use `break-inside: avoid` on cards and `break-before: page` before major sections.
- **`@react-pdf/renderer`**: Content flows onto additional `<Page>` components.

### 4.6 Single Source of Truth

The `CmaPdfDocument.tsx` layout is **currently independent** of the screen components. To guarantee pixel‑perfect parity, the recommended approach is to send the **same HTML** that the browser print page renders to the Puppeteer microservice.

Build the HTML on Vercel using `renderToString` or by fetching the print page URL after it hydrates:

```ts
// lib/pdfServer.ts (runs on Vercel, calls Lightsail)
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL; // e.g. https://pdf.domuzz.com

export async function renderPdf(html: string): Promise<Buffer> {
  const response = await fetch(`${PDF_SERVICE_URL}/api/pdf/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.PDF_SERVICE_TOKEN}` },
    body: JSON.stringify({ html }),
  });
  if (!response.ok) throw new Error(`PDF service returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
```

---

## 5. Lightsail PDF Microservice Setup

### 5.1 Recommended Instance

| Spec | Recommendation |
|---|---|
| **Blueprint** | OS Only → Ubuntu 24.04 LTS |
| **Plan** | **1 GB RAM, 1 vCPU** ($7/mo) — Chromium alone uses ~300–500 MB at peak, so the $10/mo 2 GB plan is safer for concurrent requests |
| **Storage** | 40 GB SSD (default) |
| **Region** | Same as your Vercel deployment region (e.g. `us-east-1` for Vercel’s `iad1`) |

### 5.2 PDF Microservice Code

Create a self‑contained Node.js project. You can keep it in a separate repo or in a `pdf-service/` directory within the monorepo.

#### `pdf-service/package.json`

```json
{
  "name": "domuzz-pdf-service",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^5.1.0",
    "puppeteer": "^24.12.1"
  }
}
```

#### `pdf-service/server.js`

```js
import express from "express";
import puppeteer from "puppeteer";

const PORT = process.env.PORT || 3001;
const AUTH_TOKEN = process.env.PDF_SERVICE_TOKEN;

if (!AUTH_TOKEN) {
  console.error("FATAL: PDF_SERVICE_TOKEN environment variable is not set.");
  process.exit(1);
}

const app = express();

// Parse JSON bodies up to 5 MB (HTML can be large with inline styles/images)
app.use(express.json({ limit: "5mb" }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ── PDF Render Endpoint ──────────────────────────────────────
app.post("/api/pdf/render", async (req, res) => {
  // Auth check
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { html } = req.body;
  if (!html || typeof html !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'html' field" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",         // Use /tmp, not /dev/shm (small on Lightsail)
        "--disable-gpu",
        "--single-process",                // Lower memory on single‑vCPU
      ],
    });

    const page = await browser.newPage();

    // Set a realistic viewport so CSS media queries resolve correctly
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });

    await page.setContent(html, {
      waitUntil: "networkidle0",  // Wait for fonts, images, charts to load
      timeout: 30_000,
    });

    const pdf = await page.pdf({
      format: "Letter",
      margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
      printBackground: true,
      preferCSSPageSize: true,
    });

    res
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="cma-report.pdf"',
        "X-Render-Time-Ms": String(Date.now() - req.startTime),
      })
      .send(Buffer.from(pdf));
  } catch (err) {
    console.error("PDF render error:", err);
    res.status(500).json({ error: "PDF rendering failed", detail: err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

// Track request start time for the X-Render-Time-Ms header
app.use((req, _res, next) => {
  req.startTime = Date.now();
  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PDF microservice listening on port ${PORT}`);
});
```

### 5.3 Dockerfile for the PDF Service

Create `pdf-service/Dockerfile`:

```dockerfile
FROM node:22-alpine

# Install Chromium and its system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-liberation \
    font-noto \
    font-noto-emoji

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 3001

# Run as non-root for security
USER node

CMD ["node", "server.js"]
```

### 5.4 Deploy to Lightsail (Step by Step)

#### Step 1: Launch the instance

In Lightsail console → Create Instance:

- **Blueprint**: OS Only → Ubuntu 24.04 LTS
- **Plan**: $10/mo (2 GB RAM) — the $7/mo plan works but may OOM under concurrent requests
- Name: `domuzz-pdf`

#### Step 2: Open ports

Lightsail console → Networking → IPv4 Firewall → Add rules:

| Protocol | Port | Source |
|---|---|---|
| SSH | 22 | Anywhere (0.0.0.0/0) |
| HTTPS | 443 | Anywhere (0.0.0.0/0) |
| Custom/TCP | 3001 | Restrict to Vercel IP ranges (see [Vercel IPs](https://vercel.com/docs/security/ip-addresses)) |

> For production, restrict port 3001 to Vercel’s outbound IP ranges. You can also skip exposing 3001 entirely and rely only on Caddy (port 443) with the auth token.

#### Step 3: Attach a static IP

Lightsail → Networking → Create static IP → Attach to `domuzz-pdf`.

Point a DNS A record (e.g. `pdf.domuzz.com`) at this IP.

#### Step 4: SSH in and install Docker

```bash
ssh ubuntu@<static-ip>
sudo apt update && sudo apt install -y docker.io
sudo usermod -aG docker ubuntu
newgrp docker
```

#### Step 5: Deploy the microservice

```bash
mkdir -p ~/pdf-service && cd ~/pdf-service

# Copy your pdf-service/* files to this directory (scp, git clone, etc.)
# Create a .env file:
echo 'PDF_SERVICE_TOKEN=<generate-a-long-random-token>' > .env
echo 'PORT=3001' >> .env

# Build and run
sudo docker build -t domuzz-pdf .
sudo docker run -d \
  --name pdf-service \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:3001:3001 \
  domuzz-pdf
```

#### Step 6: Set up Caddy for HTTPS (reverse proxy)

Caddy auto‑provisions TLS and proxies to the Docker container.

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
pdf.domuzz.com {
    reverse_proxy 127.0.0.1:3001
}
```

```bash
sudo systemctl restart caddy
```

Now the microservice is accessible at `https://pdf.domuzz.com/api/pdf/render`.

> **Security note**: Caddy handles TLS. The `PDF_SERVICE_TOKEN` bearer token in the `Authorization` header is the second layer of auth — only Vercel (which holds the token in its environment variables) can call the endpoint.

---

## 6. Connecting Vercel to Lightsail

### 6.1 Vercel Environment Variables

In Vercel dashboard → Project Settings → Environment Variables, add:

| Key | Value | Environment |
|---|---|---|
| `PDF_SERVICE_URL` | `https://pdf.domuzz.com` | Production, Preview |
| `PDF_SERVICE_TOKEN` | Same long random token from step 5.5 | Production, Preview |

### 6.2 Create the Vercel PDF API Route

Create `app/api/cma/pdf/route.ts` in the Next.js app:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL;
const PDF_SERVICE_TOKEN = process.env.PDF_SERVICE_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const { reportData, aiAnalysis, renovationData } = await request.json();

    if (!reportData) {
      return NextResponse.json({ error: "Missing reportData" }, { status: 400 });
    }

    // 1. Build the HTML by rendering a server component string,
    //    or use renderToString from react-dom/server.
    //    For simplicity, you can fetch the print page:
    const html = await buildPrintHtml({ reportData, aiAnalysis, renovationData });

    // 2. Send HTML to Lightsail PDF microservice
    const pdfResponse = await fetch(`${PDF_SERVICE_URL}/api/pdf/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PDF_SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ html }),
    });

    if (!pdfResponse.ok) {
      console.error("PDF service error:", pdfResponse.status);
      return NextResponse.json(
        { error: "PDF generation failed" },
        { status: 502 }
      );
    }

    // 3. Stream PDF back to client
    const pdfBuffer = await pdfResponse.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cma-report.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Build the full HTML string for the print page.
 *
 * Options:
 * A) Use ReactDOMServer.renderToString on a server component (fastest, no network call).
 * B) Fetch the app's own /cma/print page with query params.
 *
 * Option A is preferred as it avoids a self-referencing HTTP call on Vercel.
 */
async function buildPrintHtml(data: {
  reportData: unknown;
  aiAnalysis: string | null;
  renovationData: unknown;
}): Promise<string> {
  // TODO: Use renderToString from react-dom/server to render the full
  //       CMA report card + table + AI analysis as static HTML.
  //       See Section 6.3 below for the implementation pattern.
  throw new Error("buildPrintHtml not implemented yet — see guide Section 6.3");
}
```

### 6.3 Building the HTML String on Vercel (renderToString Pattern)

Since `@react-pdf/renderer` has its own primitives and can’t render your real Tailwind components, the recommended approach for pixel‑perfect parity is to use Puppeteer against the **actual browser‑print HTML**.

Add a dedicated helper that builds the HTML statically:

```ts
// lib/buildPrintHtml.ts
import { renderToString } from "react-dom/server";
import { CMAReportData, RENOVATION_OPTIONS } from "@/lib/cma";

interface BuildPrintHtmlParams {
  reportData: CMAReportData;
  aiAnalysis: string | null;
  renovationData: {
    renovations: Record<string, number>;
    adjustedValue: number;
    addedValue: number;
    totalSpent: number;
  } | null;
}

/**
 * Builds the full HTML document for the print page.
 * This mirrors app/cma/print/page.tsx but is fully server‑renderable.
 */
export function buildPrintHtml(params: BuildPrintHtmlParams): string {
  const { reportData, aiAnalysis, renovationData } = params;

  // Render the component tree to a static HTML string.
  // You may need to extract the component logic into a shared presentational
  // component (e.g. PrintReportContent) that both app/cma/print/page.tsx
  // and this function use, avoiding duplicate code.

  const bodyHtml = renderToString(
    <PrintReportContent
      reportData={reportData}
      aiAnalysis={aiAnalysis}
      renovationData={renovationData}
    />
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CMA Report — ${escapeHtml(reportData.subjectProperty.address)}</title>
  <link rel="stylesheet" href="${process.env.VERCEL_URL ?? "https://domuzz.com"}/_next/static/css/..." />
  <style>
    @page { size: letter; margin: 0.5in; }
    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      width: 7.5in;
      margin: 0 auto;
      color: #1a1a1a;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
```

> **Important**: The `<link>` tag must point to the built CSS. In Next.js, you can inline the critical CSS into a `<style>` tag at build time, or use a separate CSS endpoint. The simplest approach is to inline all styles from `globals.css` plus Tailwind’s compiled output.

### 6.4 Wiring the CMA Page to Use the PDF API

In `app/cma/page.tsx` (or whichever client component has the "Download PDF" button), add:

```tsx
async function handleDownloadPdf() {
  const response = await fetch("/api/cma/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportData,
      aiAnalysis,
      renovationData,
    }),
  });

  if (!response.ok) {
    alert("PDF generation failed. Please try again.");
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CMA-Report-${reportData.subjectProperty.address.replace(/\s+/g, "-")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 7. Verifying PDF Fidelity

After deployment, run these checks to confirm output is pixel‑perfect:

### 7.1 Visual Diff Checklist

- [ ] PDF text uses **Inter**, not a fallback sans‑serif
- [ ] Estimate value card is **centered**, same shade of indigo/blue
- [ ] Table columns align exactly with headers (no wrapping in narrow columns)
- [ ] Page breaks do not slice cards in half
- [ ] Colours match across screen, browser PDF, and server PDF
- [ ] Disclaimer footer appears at the bottom of the **last page**, not overlapping content
- [ ] Special characters (em‑dashes, smart quotes, `—`) render without tofu

### 7.2 Compare Both Paths

1. Open `domuzz.com/cma/print?address=...` — Ctrl+P → Save as PDF
2. Click **Download PDF** from the CMA results page (calls Vercel → Lightsail)
3. Open both PDFs side‑by‑side in a viewer at 100% zoom
4. Toggle back and forth — they should be **indistinguishable**

### 7.3 Automated Visual Regression (Advanced)

A Playwright script in CI that:

1. Sends a test address to the Vercel PDF endpoint.
2. Converts PDF page 1 to a PNG.
3. Compares against a golden image with `pixelmatch`.
4. Fails if pixel difference > 0.5%.

---

## 8. Checklist

### Lightsail Microservice

- [ ] Launch Ubuntu 24.04 instance (≥2 GB RAM, $10/mo)
- [ ] Attach static IP, set DNS A record (`pdf.domuzz.com`)
- [ ] Open ports: 22, 443 (and optionally 3001 restricted to Vercel IPs)
- [ ] Install Docker
- [ ] Deploy `pdf-service/` Docker container
- [ ] Set `PDF_SERVICE_TOKEN` env var on the container
- [ ] Install Caddy, configure reverse proxy to `127.0.0.1:3001`
- [ ] Verify healthcheck: `curl https://pdf.domuzz.com/health`

### Vercel App

- [ ] Add `PDF_SERVICE_URL` and `PDF_SERVICE_TOKEN` to Vercel environment variables
- [ ] Create `app/api/cma/pdf/route.ts` (PDF API route)
- [ ] Create `lib/buildPrintHtml.ts` (server‑side HTML renderer)
- [ ] Refactor `app/cma/print/page.tsx` to share components with `buildPrintHtml`
- [ ] Wire "Download PDF" button in the CMA results page

### Pre‑deployment

- [ ] Download Inter `.ttf` files to `public/fonts/`
- [ ] Add `@page { size: letter; margin: 0.5in; }` to global print styles
- [ ] Add `print-color-adjust: exact` to global print styles
- [ ] Inline Tailwind CSS into `buildPrintHtml` output

### Post‑deployment Verification

- [ ] Open print page in browser, Ctrl+P → Save as PDF
- [ ] Click Download PDF from CMA results page
- [ ] Compare TTF font rendering in both
- [ ] Compare colours, margins, table alignment
- [ ] Test with a long AI analysis (multi‑paragraph) to verify page breaks
- [ ] Test with many comparables (15+) to verify table overflow
- [ ] Test concurrent requests (ensure Lightsail doesn’t OOM)

---

**References**

- [@react-pdf/renderer docs](https://react-pdf.org/)
- [Puppeteer PDF generation](https://pptr.dev/api/puppeteer.page.pdf)
- [Amazon Lightsail docs](https://docs.aws.amazon.com/lightsail/)
- [Inter font on Google Fonts](https://fonts.google.com/specimen/Inter)
- [Vercel IP ranges](https://vercel.com/docs/security/ip-addresses)
- [Caddy reverse proxy](https://caddyserver.com/docs/quick-starts/reverse-proxy)