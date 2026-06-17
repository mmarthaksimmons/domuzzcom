const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const ACTOR = "maxcopell~zillow-detail-scraper";

/**
 * Scrape Zillow property details using addresses instead of URLs.
 *
 * Uses maxcopell~zillow-detail-scraper which accepts an "addresses" array
 * (e.g. ["123 Main St, City, State"]) and returns full listing data.
 * This avoids scraping Zillow property detail URLs to comply with Zillow ToS.
 */
export async function scrapeByAddresses(addresses: string[]) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}&maxItems=${addresses.length}`,
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