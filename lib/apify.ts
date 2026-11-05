const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const DETAIL_ACTOR = "maxcopell~zillow-detail-scraper";
const ZIP_ACTOR = "maxcopell~zillow-zip-search";

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
 * CMA: two-phase Apify pipeline using zip-search for both active and sold.
 *
 * Phase 1: detail scraper → subject property (beds/baths/sqft/zip/lat/lng/photo)
 * Phase 2: zip-search scraper → active for-sale + recently-sold area comps
 *
 * Returns { results, soldResults } — sold comps kept separate for two-section UI.
 */
export async function scrapeCmaComps(address: string) {
  const results: any[] = [];
  let soldResults: any[] = [];

  // Phase 1: Subject property
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

  const prop = detailData[0];
  const zipCode: string | undefined =
    prop.listingAddress?.zipCode ??
    prop.zipcode ??
    prop.address?.zipcode ??
    prop.addressZipCode ??
    undefined;

  // Phase 2a: Active for-sale comps via zip-search
  if (zipCode) {
    try {
      const activeRes = await fetch(
        `https://api.apify.com/v2/acts/${ZIP_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=20`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zipCodes: [zipCode],
            forSaleByAgent: true,
            forSaleByOwner: false,
            forRent: false,
            sold: false,
            maxItems: 20,
          }),
        }
      );
      if (activeRes.ok) {
        const activeData = (await activeRes.json()) as any[];
        results.push(...activeData);
      } else {
        console.warn(`CMA active zip-search failed: HTTP ${activeRes.status}`);
      }
    } catch (err) {
      console.warn("CMA active zip-search error:", err);
    }

    // Phase 2b: Sold comps via zip-search
    try {
      const soldRes = await fetch(
        `https://api.apify.com/v2/acts/${ZIP_ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=20`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            zipCodes: [zipCode],
            sold: true,
            forSaleByAgent: false,
            maxItems: 20,
          }),
        }
      );
      if (soldRes.ok) {
        soldResults = (await soldRes.json()) as any[];
      } else {
        console.warn(`CMA sold zip-search failed: HTTP ${soldRes.status}`);
      }
    } catch (err) {
      console.warn("CMA sold zip-search error:", err);
    }
  }

  return { results, soldResults };
}