const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const DETAIL_ACTOR = "maxcopell~zillow-detail-scraper";
const SEARCH_ACTOR = "maxcopell~zillow-scraper";

/**
 * Scrape Zillow property details using addresses instead of URLs.
 * Uses maxcopell~zillow-detail-scraper which accepts an "addresses" array
 * (e.g. ["123 Main St, City, State"]) and returns full listing data.
 */
export async function scrapeByAddresses(addresses: string[], maxItems?: number) {
  const limit = maxItems ?? addresses.length;
  const res = await fetch(
    `https://api.apify.com/v2/acts/${DETAIL_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=${limit}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses,
        propertyStatus: "FOR_SALE",
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify error ${res.status}: ${body}`);
  }
  return (await res.json()) as any[];
}

/**
 * Build a Zillow search URL with proper searchQueryState for the search scraper.
 * The URL must contain ?searchQueryState=... with mapBounds, filterState, etc.
 */
function buildZillowSearchUrl(
  lat: number,
  lng: number,
  isSold: boolean
): string {
  // Create a ~5-mile bounding box around the property
  const delta = 0.07; // roughly 5 miles in lat/lng
  const west = lng - delta;
  const east = lng + delta;
  const south = lat - delta;
  const north = lat + delta;

  const state: Record<string, unknown> = {
    pagination: {},
    isMapVisible: true,
    mapBounds: { west, east, south, north },
    filterState: {
      sort: { value: "globalrelevanceex" },
    },
    isListVisible: true,
  };

  if (isSold) {
    (state.filterState as Record<string, unknown>).isSold = { value: true };
  }

  const searchQueryState = encodeURIComponent(JSON.stringify(state));
  const path = isSold
    ? "https://www.zillow.com/homes/sold/"
    : "https://www.zillow.com/homes/for_sale/";

  return `${path}?searchQueryState=${searchQueryState}`;
}

/**
 * CMA-specific: fetch a subject property via the detail scraper, extract
 * its lat/lng, then use the Zillow search scraper to find nearby sold and
 * active comparables. Returns the combined result set.
 *
 * The search scraper (maxcopell~zillow-scraper) requires Zillow search
 * URLs with a valid ?searchQueryState=... fragment containing mapBounds,
 * filterState, and isListVisible — see the actor README for details.
 */
export async function scrapeCmaComps(address: string) {
  const results: any[] = [];

  // Step 1: get subject property from detail scraper
  const detailRes = await fetch(
    `https://api.apify.com/v2/acts/${DETAIL_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=1`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [address],
        propertyStatus: "FOR_SALE",
      }),
    }
  );
  if (!detailRes.ok) {
    const body = await detailRes.text();
    throw new Error(`Apify detail error ${detailRes.status}: ${body}`);
  }
  const detailData = (await detailRes.json()) as any[];
  if (!detailData || detailData.length === 0) {
    throw new Error("No property found at this address");
  }
  results.push(detailData[0]);

  // Step 2: extract coordinates to scope the area search
  const prop = detailData[0];
  const lat: number | undefined =
    prop.latitude ?? prop.lat ?? prop.address?.latitude ?? undefined;
  const lng: number | undefined =
    prop.longitude ?? prop.lng ?? prop.address?.longitude ?? undefined;

  // Step 3: if we have coordinates, search for nearby sold + active listings
  if (lat != null && lng != null) {
    const searchRequests = [
      { url: buildZillowSearchUrl(lat, lng, true), label: "sold" },
      { url: buildZillowSearchUrl(lat, lng, false), label: "active" },
    ];

    for (const { url, label } of searchRequests) {
      try {
        const searchRes = await fetch(
          `https://api.apify.com/v2/acts/${SEARCH_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=25`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              searchUrls: [{ url }],
              extractionMethod: "PAGINATION_WITH_ZOOM_IN",
              maxItems: 25,
            }),
          }
        );
        if (searchRes.ok) {
          const searchData = (await searchRes.json()) as any[];
          results.push(...searchData);
        } else {
          console.warn(
            `CMA search scraper failed for ${label}: HTTP ${searchRes.status}`
          );
        }
      } catch (err) {
        console.warn(`CMA search scraper error for ${label}:`, err);
      }
    }
  }

  return results;
}