/**
 * Single source of truth for the site's public identity.
 *
 * Every absolute URL the app emits (sitemap entries, canonical/OpenGraph URLs,
 * links inside emails) is derived from here, so a fork or self-hosted instance
 * only has to set `NEXT_PUBLIC_SITE_URL` once instead of editing many files.
 *
 * The Domuzz production URL is the default so existing deployments behave
 * exactly as before; set `NEXT_PUBLIC_SITE_URL` in any fork.
 */

const DEFAULT_SITE_URL = "https://www.domuzz.com";

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return DEFAULT_SITE_URL;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

/** Absolute origin, no trailing slash. e.g. "https://www.domuzz.com" */
export const siteUrl = resolveSiteUrl();

/** Host without the protocol. e.g. "www.domuzz.com" */
export const siteHost = siteUrl.replace(/^https?:\/\//i, "");

/** Public product name, used for OG `siteName` and page titles. */
export const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Domuzz";

/** Default description used for metadata where a page has none of its own. */
export const siteDescription =
  "Compare properties side-by-side, generate free CMA reports, and calculate FSBO savings — no agent required.";
