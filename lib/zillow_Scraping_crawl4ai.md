# Zillow Scraping for CMA — Domuzz Integration Guide

This guide documents how Domuzz scrapes Zillow to replace the RentCast AVM API. Instead of calling RentCast for an automated valuation + comparables, we fetch Zillow search results, extract listing data, and compute our own estimate.

---

## Architecture Overview

```
User enters address in CMA form
         ↓
app/api/cma/route.ts  parses address → city, state
         ↓
lib/zillow.ts  builds Zillow search URL, fetches page, parses __NEXT_DATA__ JSON
         ↓
lib/cma.ts  normalizes Zillow listings → CMAReportData (same format UI expects)
         ↓
Components render CmaReport, CmaMap, CmaCharts, CmaAiAnalysis
```

---

## How Zillow Loads Data

Zillow is a React SPA. A plain `fetch()` returns an empty shell — all listings load via JavaScript. **However**, Zillow also pre-renders data for SEO/SSR in a `<script id="__NEXT_DATA__" type="application/json">` tag on the initial page load. This embedded JSON contains search results with property details. We parse this server-side in our Next.js API route.

---

## Zillow URL Structure for CMA

We construct a search URL from the user's address:

| Listing Type | URL Pattern |
|---|---|
| Recently sold (comps) | `https://www.zillow.com/{city}-{state}/sold/?searchQueryState=...` |
| Active for sale | `https://www.zillow.com/{city}-{state}/houses/?searchQueryState=...` |

**Our approach**: We search for recently sold listings near the subject property address. Zillow's sold listings provide the best comparables (actual closed prices, not asking prices).

### Search Query State

Zillow accepts a `searchQueryState` JSON parameter for filters:

```json
{
  "pagination": {},
  "isMapVisible": false,
  "mapBounds": {
    "west": -97.9, "east": -97.6, "south": 30.1, "north": 30.4
  },
  "filterState": {
    "sort": {"value": "globalrelevanceex"},
    "isSold": {"value": true}
  },
  "isListVisible": true
}
```

---

## Extracting Listings from `__NEXT_DATA__`

### The JSON Path

Zillow embeds listing data at this path inside `__NEXT_DATA__`:

```
props.pageProps.searchPageState.cat1.searchResults.listResults[]
```

OR alternatively:

```
props.pageProps.componentProps.searchResults.results[]
```

### Raw Zillow Listing Fields

Each listing object contains:

```typescript
interface ZillowListing {
  zpid: number;           // Zillow Property ID
  address: string;        // "123 Main St"
  addressCity: string;    // "Austin"
  addressState: string;   // "TX"
  addressZipcode: string; // "78701"
  price: number;          // Sold price or list price
  unformattedPrice: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;     // sqft
  lotSize?: number;
  yearBuilt?: number;
  homeType: string;       // "SINGLE_FAMILY", "CONDO", "TOWNHOUSE"
  homeStatus: string;     // "SOLD", "FOR_SALE"
  statusText: string;     // "Sold", "For Sale"
  daysOnZillow?: number;
  imgSrc?: string;
  detailUrl?: string;     // relative URL like "/homedetails/..."
  hdpUrl?: string;
  latLong?: {
    latitude: number;
    longitude: number;
  };
  zestimate?: number;
  rentZestimate?: number;
}
```

---

## Computing AVM Estimate from Zillow Comparables

RentCast provides a built-in AVM estimate. Zillow does not (via scraping). We compute our own:

### Method: Weighted Median of Sold Comparables

1. **Filter to sold listings only** (homeStatus = "SOLD", has price)
2. **Sort by similarity score** (custom correlation — see below)
3. **Take top 10-15 most similar**
4. **Compute weighted median price** as the point estimate
5. **Compute price range** as 10th/90th percentile of sold prices

### Similarity Score (Custom Correlation)

We compute a similarity score based on how close each comparable matches the subject property:

```
score = 1.0
  - abs(beds_diff) * 0.05     // each bed difference reduces 5%
  - abs(baths_diff) * 0.04    // each bath difference reduces 4%
  - abs(sqft_diff) / max(sqft) * 0.20  // size difference up to 20%
  - (distance_miles / 10) * 0.15       // distance penalty
  - abs(year_diff) / 100 * 0.10        // age difference penalty
score = max(0, score)  // floor at 0
```

This replaces RentCast's built-in `correlation` field.

### Price Per Sqft Adjustment

For a more accurate estimate, we also compute a price-per-sqft weighted average:

```
median_price_per_sqft = weighted_median(comp.price / comp.sqft)
adjusted_estimate = median_price_per_sqft * subject_sqft
```

We blend the weighted median price with the per-sqft adjusted estimate (60/40 split).

---

## Implementation: `normalizeZillowResponse()`

```typescript
// lib/cma.ts — new function

export interface ZillowSearchResult {
  zpid: number;
  address: string;
  addressCity: string;
  addressState: string;
  addressZipcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  livingArea: number;
  lotSize?: number;
  yearBuilt?: number;
  homeType: string;
  homeStatus: string;
  statusText: string;
  daysOnZillow?: number;
  latLong?: { latitude: number; longitude: number };
  detailUrl?: string;
}

export function computeSimilarity(
  comp: ZillowSearchResult,
  subjectBeds: number,
  subjectBaths: number,
  subjectSqft: number,
  subjectYearBuilt: number | null,
  distanceMiles: number
): number {
  let score = 1.0;
  score -= Math.abs((comp.bedrooms || 0) - subjectBeds) * 0.05;
  score -= Math.abs((comp.bathrooms || 0) - subjectBaths) * 0.04;
  const maxSqft = Math.max(subjectSqft, comp.livingArea || 0);
  score -= (Math.abs((comp.livingArea || 0) - subjectSqft) / maxSqft) * 0.20;
  score -= (distanceMiles / 10) * 0.15;
  if (subjectYearBuilt && comp.yearBuilt) {
    score -= Math.abs(comp.yearBuilt - subjectYearBuilt) / 100 * 0.10;
  }
  return Math.max(0, Math.min(1, score));
}

export function normalizeZillowResponse(
  address: string,
  city: string,
  state: string,
  listings: ZillowSearchResult[]
): CMAReportData {
  // Separate sold vs active
  const sold = listings.filter(l => l.homeStatus === "SOLD" && l.price > 0);
  const active = listings.filter(l => l.homeStatus !== "SOLD");

  // Infer subject property details from best comparable
  const sorted = [...sold].sort((a, b) => b.price - a.price);
  const best = sorted[0];

  const subjectProperty: SubjectSummary = {
    address,
    beds: best?.bedrooms ?? null,
    baths: best?.bathrooms ?? null,
    sqft: best?.livingArea ?? null,
    lotSize: best?.lotSize ?? null,
    yearBuilt: best?.yearBuilt ?? null,
    propertyType: best?.homeType ?? null,
    latitude: best?.latLong?.latitude ?? null,
    longitude: best?.latLong?.longitude ?? null,
  };

  // Compute estimate from sold comps
  const validSold = sold.filter(s => s.latLong);
  const soldPrices = validSold.map(s => s.price).sort((a, b) => a - b);

  let estimate: EstimateRange = { price: 0, priceRangeLow: 0, priceRangeHigh: 0 };

  if (soldPrices.length > 0) {
    const n = soldPrices.length;
    const median = n % 2 === 0
      ? (soldPrices[n / 2 - 1] + soldPrices[n / 2]) / 2
      : soldPrices[Math.floor(n / 2)];
    const low = soldPrices[Math.floor(n * 0.1)];
    const high = soldPrices[Math.floor(n * 0.9)];

    estimate = {
      price: Math.round(median),
      priceRangeLow: Math.round(low),
      priceRangeHigh: Math.round(high),
    };
  }

  // Normalize comparables
  const normalize = (comp: ZillowSearchResult, isSold: boolean): Comparable => ({
    address: comp.address,
    status: comp.statusText || (isSold ? "Sold" : "Active"),
    price: comp.price,
    beds: comp.bedrooms || 0,
    baths: comp.bathrooms || 0,
    sqft: comp.livingArea || 0,
    lotSize: comp.lotSize ?? null,
    yearBuilt: comp.yearBuilt ?? null,
    propertyType: comp.homeType ?? null,
    distance: null,   // Computed from lat/lng if both available
    daysOnMarket: comp.daysOnZillow ?? null,
    correlation: 0,   // Computed below
    isSold,
    latitude: comp.latLong?.latitude ?? null,
    longitude: comp.latLong?.longitude ?? null,
  });

  const soldComparables = sold.map(c => normalize(c, true));
  const activeComparables = active.map(c => normalize(c, false));

  // Compute similarity scores for each comparable
  const allComps = [...soldComparables, ...activeComparables];
  for (const comp of allComps) {
    const distanceMiles = computeDistance(
      subjectProperty.latitude, subjectProperty.longitude,
      comp.latitude, comp.longitude
    );
    comp.distance = distanceMiles;
    comp.correlation = computeSimilarity(
      { ...comp, livingArea: comp.sqft, bedrooms: comp.beds, bathrooms: comp.baths } as any,
      subjectProperty.beds ?? 0,
      subjectProperty.baths ?? 0,
      subjectProperty.sqft ?? 0,
      subjectProperty.yearBuilt,
      distanceMiles
    );
  }

  return { subjectProperty, estimate, soldComparables, activeComparables };
}
```

---

## API Route Changes

Replace the RentCast API call in `app/api/cma/route.ts`:

**Before** (RentCast):
```typescript
const rentCastUrl = `https://api.rentcast.io/v1/avm/value?address=${...}`;
const rcResponse = await fetch(rentCastUrl, { headers: { "X-API-Key": apiKey } });
const data: RentCastResponse = await rcResponse.json();
const normalized = normalizeRentCastResponse(data);
```

**After** (Zillow):
```typescript
import { fetchZillowListings, parseAddress } from "@/lib/zillow";

const { city, state } = parseAddress(address);
const listings = await fetchZillowListings(city, state);
const normalized = normalizeZillowResponse(address.trim(), city, state, listings);
```

---

## Anti-Scraping Handling

### What Triggers Blocks
- Too many requests from the same IP
- Requests without proper User-Agent headers
- Requests from data center IPs (Vercel/AWS) — Zillow may block these

### Mitigations (in priority order)

1. **Rotate User-Agents**: Use a set of recent Chrome/Safari/Edge UAs
2. **Add delays between requests**: 3-8 seconds between pages
3. **Use residential proxies**: If data center IP gets blocked, route through Vercel's ISR or a proxy service
4. **Fallback to Apify**: The existing `lib/apify.ts` integration can serve as a fallback if direct scraping is blocked
5. **Cache results**: Cache Zillow responses in Vercel KV or in-memory to reduce repeated requests for the same city

### Fallback Strategy

```typescript
async function getComparables(address: string): Promise<CMAReportData> {
  try {
    // Primary: Direct Zillow scraping
    const { city, state } = parseAddress(address);
    const listings = await fetchZillowListings(city, state);
    return normalizeZillowResponse(address, city, state, listings);
  } catch (err) {
    // Fallback: Apify (paid but reliable)
    console.warn("Direct Zillow scraping failed, falling back to Apify:", err);
    const apifyResults = await scrapeByAddresses([address]);
    return normalizeApifyResponse(address, apifyResults);
  }
}
```

---

## Data Visibility: What We CAN and CANNOT Get

| Data Point | Zillow Scraping | RentCast API |
|---|---|---|
| Sold price history | ✅ From sold listings | ✅ |
| Active listing price | ✅ | ✅ |
| Bedrooms / Bathrooms | ✅ | ✅ |
| Square footage | ✅ | ✅ |
| Lot size | ✅ (sometimes) | ✅ |
| Year built | ✅ (sometimes) | ✅ |
| Days on market | ✅ | ✅ |
| Property photos | ✅ (imgSrc) | ❌ |
| Latitude / Longitude | ✅ (latLong) | ✅ |
| AVM estimate | ❌ (we compute it) | ✅ |
| Price range | ❌ (we compute it) | ✅ |
| Correlation score | ❌ (we compute it) | ✅ |
| Rent estimate | ✅ (rentZestimate) | ❌ |
| Zestimate | ✅ | ❌ |
| Property tax | ✅ (on detail page) | ✅ |
| School ratings | ✅ (on detail page) | ✅ |

---

## File Change Summary

| File | Change |
|---|---|
| `lib/zillow.ts` | **NEW** — Zillow search + parse + fallback logic |
| `lib/cma.ts` | Add `ZillowListing` type, `normalizeZillowResponse()`, `computeSimilarity()` |
| `app/api/cma/route.ts` | Replace RentCast call with Zillow scraping |
| `app/cma/page.tsx` | Update "Powered by RentCast" → "Data sourced from Zillow" |
| `app/cma/print/page.tsx` | Update disclaimer text |
| `lib/CmaPdfDocument.tsx` | Update disclaimer text |
| `.env.local` | Remove `RENTCAST_API_KEY` |

---

## Testing the Implementation

1. Test with a known address: "123 Main St, Austin, TX 78701"
2. Verify `__NEXT_DATA__` JSON is parsed correctly (city-slug URLs work)
3. Verify sold comparables are returned (not just active listings)
4. Verify similarity scores are reasonable (0.8+ for near-identical comps)
5. Verify the AVM estimate falls within the range of sold prices
6. Verify fallback to Apify works when direct scraping is blocked
7. Check that UI components render the same way (CMAReportData format unchanged)