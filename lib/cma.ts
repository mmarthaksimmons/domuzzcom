// Types for RentCast CMA integration
// Based on actual RentCast /avm/value response format (GET, X-API-Key auth)

/** Raw comparable from RentCast */
export interface RentCastComparable {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize?: number;
  yearBuilt?: number;
  status?: string;
  price: number;
  listingType?: string;
  listedDate?: string;
  removedDate?: string | null;
  lastSeenDate?: string;
  daysOnMarket?: number;
  distance?: number;
  daysOld?: number;
  correlation: number;
}

/** Subject property from RentCast (minimal: just address + coordinates) */
export interface RentCastSubjectProperty {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  stateFips?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface RentCastResponse {
  price?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  latitude?: number;
  longitude?: number;
  subjectProperty?: RentCastSubjectProperty;
  comparables?: RentCastComparable[];
  error?: string;
}

/** Normalized comparable for UI display */
export interface Comparable {
  address: string;
  status: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  distance: number | null;
  daysOnMarket: number | null;
  correlation: number;
  isSold: boolean;
  latitude: number | null;
  longitude: number | null;
}

/** Subject property summary */
export interface SubjectSummary {
  address: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
}

/** Estimate range */
export interface EstimateRange {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
}

/** Full CMA report data */
export interface CMAReportData {
  subjectProperty: SubjectSummary;
  estimate: EstimateRange;
  soldComparables: Comparable[];
  activeComparables: Comparable[];
}

/** Renovation option */
export interface RenovationOption {
  key: string;
  label: string;
  roiPercent: number;
}

export const RENOVATION_OPTIONS: RenovationOption[] = [
  { key: "kitchen", label: "Kitchen Remodel", roiPercent: 60 },
  { key: "bathroom", label: "Bathroom Remodel", roiPercent: 55 },
  { key: "roof", label: "New Roof", roiPercent: 40 },
  { key: "hvac", label: "New HVAC", roiPercent: 45 },
  { key: "flooring", label: "New Flooring", roiPercent: 50 },
  { key: "paint", label: "Fresh Paint", roiPercent: 35 },
  { key: "landscaping", label: "Landscaping / Curb Appeal", roiPercent: 30 },
];

export function calculateAdjustedValue(
  baseEstimate: number,
  renovations: Record<string, number>
): { addedValue: number; adjustedValue: number } {
  let totalAddedValue = 0;
  for (const [key, amountSpent] of Object.entries(renovations)) {
    const option = RENOVATION_OPTIONS.find((o) => o.key === key);
    if (option && amountSpent > 0) {
      totalAddedValue += amountSpent * (option.roiPercent / 100);
    }
  }
  return {
    addedValue: totalAddedValue,
    adjustedValue: baseEstimate + totalAddedValue,
  };
}

function isSoldStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "sold" || s === "closed" || s === "inactive";
}

export function filterComparables(
  comparables: RentCastComparable[],
  maxCount: number = 8
): { sold: Comparable[]; active: Comparable[] } {
  const sorted = [...comparables].sort(
    (a, b) => b.correlation - a.correlation
  );

  const sold: Comparable[] = [];
  const active: Comparable[] = [];

  for (const comp of sorted) {
    const normalized: Comparable = {
      address: comp.formattedAddress,
      status: comp.status || "Unknown",
      price: comp.price,
      beds: comp.bedrooms,
      baths: comp.bathrooms,
      sqft: comp.squareFootage,
      lotSize: comp.lotSize ?? null,
      yearBuilt: comp.yearBuilt ?? null,
      propertyType: comp.propertyType ?? null,
      distance: comp.distance ?? null,
      daysOnMarket: comp.daysOnMarket ?? null,
      correlation: comp.correlation,
      isSold: isSoldStatus(comp.status),
      latitude: comp.latitude ?? null,
      longitude: comp.longitude ?? null,
    };

    if (normalized.isSold) {
      sold.push(normalized);
    } else {
      active.push(normalized);
    }
  }

  if (sold.length >= 5) {
    return { sold: sold.slice(0, maxCount), active: [] };
  }

  const needed = maxCount - sold.length;
  return { sold, active: active.slice(0, needed) };
}

function inferSubjectDetails(comps: RentCastComparable[]): {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
} {
  if (comps.length === 0) {
    return { beds: null, baths: null, sqft: null, lotSize: null, yearBuilt: null, propertyType: null };
  }
  const best = comps[0];
  return {
    beds: best.bedrooms ?? null,
    baths: best.bathrooms ?? null,
    sqft: best.squareFootage ?? null,
    lotSize: best.lotSize ?? null,
    yearBuilt: best.yearBuilt ?? null,
    propertyType: best.propertyType ?? null,
  };
}

export function normalizeRentCastResponse(
  data: RentCastResponse
): CMAReportData {
  const comps = data.comparables || [];
  const inferred = inferSubjectDetails(comps);

  const subjectProperty: SubjectSummary = {
    address: data.subjectProperty?.formattedAddress || "Unknown",
    beds: inferred.beds,
    baths: inferred.baths,
    sqft: inferred.sqft,
    lotSize: inferred.lotSize,
    yearBuilt: inferred.yearBuilt,
    propertyType: inferred.propertyType,
    latitude: data.subjectProperty?.latitude ?? data.latitude ?? null,
    longitude: data.subjectProperty?.longitude ?? data.longitude ?? null,
    photo: null,
  };

  const estimate: EstimateRange = {
    price: data.price ?? 0,
    priceRangeLow: data.priceRangeLow ?? 0,
    priceRangeHigh: data.priceRangeHigh ?? 0,
  };

  const { sold, active } = filterComparables(comps);

  return { subjectProperty, estimate, soldComparables: sold, activeComparables: active };
}

/**
 * Extract a comparable from a raw Apify result, handling both the
 * detail-scraper schema and the search-scraper schema.
 *
 * Detail scraper fields: address.streetAddress, abbreviatedAddress,
 *   bedrooms, bathrooms, livingArea, homeType, latitude, longitude, etc.
 * Search scraper fields: address (string), beds, baths, area,
 *   unformattedPrice, latLong.latitude/longitude, statusType,
 *   hdpData.homeInfo.homeType, hdpData.homeInfo.yearBuilt, etc.
 */
function parseRawComparable(
  raw: any,
  subjectLat: number | null,
  subjectLng: number | null
): Comparable | null {
  const isDetail = raw.address && typeof raw.address === "object";

  // ---- address ----
  const compAddress: string = isDetail
    ? (raw.address.streetAddress ?? raw.abbreviatedAddress ?? "")
    : (raw.address ?? "");

  // ---- price ----
  const compPrice: number | null = isDetail
    ? raw.price
    : (raw.unformattedPrice ?? null);
  if (!compPrice || compPrice <= 0) return null;

  // ---- status ----
  const compStatus: string | null = isDetail
    ? (raw.homeStatus ?? raw.statusText ?? null)
    : (raw.statusType ?? raw.statusText ?? null);

  // Determine if property is no longer actively for sale.
  // "OTHER" = off-market/pending/contingent (not active), treat as inactive.
  const isSold =
    compStatus === "SOLD" ||
    compStatus === "Sold" ||
    compStatus === "FOR_SALE_CLOSED" ||
    compStatus === "OTHER" ||
    (typeof compStatus === "string" && compStatus.toLowerCase().includes("sold"));

  // ---- beds / baths / sqft ----
  const compBeds: number = (isDetail ? raw.bedrooms : raw.beds) ?? 0;
  const compBaths: number = (isDetail ? raw.bathrooms : raw.baths) ?? 0;
  const compSqft: number = (isDetail
    ? (raw.livingArea ?? raw.livingAreaValue)
    : raw.area) ?? 0;

  // ---- property type ----
  const hdpType = raw.hdpData?.homeInfo?.homeType;
  const rawType = isDetail
    ? (raw.homeType ?? raw.propertyType)
    : (hdpType ?? raw.homeType ?? raw.propertyType);
  const compPropertyType = formatHomeTypeAsPropertyType(rawType);

  // ---- year built / lot size ----
  const compYearBuilt: number | null = isDetail
    ? raw.yearBuilt
    : (hdpType ? raw.hdpData?.homeInfo?.yearBuilt : null) ?? null;
  const compLotSize: number | null = isDetail
    ? (raw.lotAreaValue ?? raw.lotSize)
    : null;

  // ---- coordinates ----
  const compLat: number | null = isDetail
    ? (raw.latitude ?? raw.lat)
    : raw.latLong?.latitude ?? null;
  const compLng: number | null = isDetail
    ? (raw.longitude ?? raw.lng)
    : raw.latLong?.longitude ?? null;

  // ---- days on market ----
  let compDom: number | null = null;
  if (isDetail) {
    compDom = raw.daysOnZillow ?? null;
  } else {
    // Search scraper: try hdpData.homeInfo.daysOnZillow first,
    // then parse variableData.text like "38 days on Zillow"
    const hdpDom = raw.hdpData?.homeInfo?.daysOnZillow;
    if (hdpDom != null && hdpDom >= 0) {
      compDom = hdpDom;
    } else {
      const varText = raw.variableData?.text;
      if (varText && typeof varText === "string") {
        const match = varText.match(/(\d+)\s*days?\s*on\s*Zillow/i);
        if (match) compDom = parseInt(match[1], 10);
      }
    }
  }

  // ---- distance ----
  const dist = computeDistance(subjectLat, subjectLng, compLat, compLng);

  return {
    address: compAddress || "—",
    status: compStatus ?? (isSold ? "Sold" : "Active"),
    price: compPrice,
    beds: compBeds,
    baths: compBaths,
    sqft: compSqft,
    lotSize: compLotSize,
    yearBuilt: compYearBuilt,
    propertyType: compPropertyType,
    distance: dist,
    daysOnMarket: compDom,
    correlation: 0.85,
    isSold,
    latitude: compLat,
    longitude: compLng,
  };
}

/**
 * Normalize Apify results (detail scraper + search scraper) into CMAReportData.
 *
 * The results array contains:
 *   [0] = subject property from detail scraper
 *   [1..N] = area comparables from search scraper (sold + active)
 *
 * We extract subject details from result[0], build comparables from all
 * results, and compute an estimate from the sold comps median.
 */
export function normalizeApifyCmaResponse(
  address: string,
  rawResults: any[]
): CMAReportData {
  if (!rawResults || rawResults.length === 0) {
    throw new Error("No property data returned from Apify");
  }

  // ---- Subject property (result[0], from detail scraper) ----
  const best = rawResults[0];
  const isDetailSubject = best.address && typeof best.address === "object";

  const subjectLat: number | null = isDetailSubject
    ? (best.latitude ?? best.lat ?? null)
    : best.latLong?.latitude ?? null;
  const subjectLng: number | null = isDetailSubject
    ? (best.longitude ?? best.lng ?? null)
    : best.latLong?.longitude ?? null;

  const subjectAddress = isDetailSubject
    ? (best.address?.streetAddress ?? best.abbreviatedAddress ?? best.address ?? address)
    : (best.address ?? address);

  const subjectBeds: number | null = isDetailSubject
    ? (best.bedrooms ?? null)
    : (best.beds ?? null);

  const subjectBaths: number | null = isDetailSubject
    ? (best.bathrooms ?? null)
    : (best.baths ?? null);

  const subjectSqft: number | null = isDetailSubject
    ? (best.livingArea ?? best.livingAreaValue ?? null)
    : (best.area ?? null);

  const subjectLotSize: number | null = isDetailSubject
    ? (best.lotAreaValue ?? best.lotSize ?? null)
    : null;

  const subjectYearBuilt: number | null = best.yearBuilt ?? null;

  const hdpHomeType = best.hdpData?.homeInfo?.homeType;
  const subjectHomeType = isDetailSubject
    ? (best.homeType ?? best.propertyType)
    : (hdpHomeType ?? best.homeType ?? best.propertyType);

  // Extract photo URL from detail scraper data.
  // Only use Zillow-hosted photos (photos.zillowstatic.com), never
  // Google Street View maps URLs which may be blocked or show errors.
  let subjectPhoto: string | null = null;
  if (isDetailSubject) {
    // Extract all photos.zillowstatic.com URLs from the raw JSON —
    // these are actual property photos, not Street View placeholders
    const raw = JSON.stringify(best);
    const matches = raw.match(/https?:\/\/photos\.zillowstatic\.com\/[^"\\]+/g);
    if (matches && matches.length > 0) {
      // Use the largest available photo (sorted by resolution suffix)
      // Suffixes: cc_ft_1536 > cc_ft_1152 > cc_ft_960 > cc_ft_768 > cc_ft_576 > cc_ft_384 > cc_ft_192
      const preferred = matches.find((u) => u.includes("cc_ft_1536"))
        ?? matches.find((u) => u.includes("cc_ft_1152"))
        ?? matches.find((u) => u.includes("cc_ft_960"))
        ?? matches[0];
      subjectPhoto = preferred;
    }
  } else {
    subjectPhoto = best.imgSrc ?? best.hdpData?.homeInfo?.photo ?? null;
  }

  const subjectProperty: SubjectSummary = {
    address: subjectAddress,
    beds: subjectBeds,
    baths: subjectBaths,
    sqft: subjectSqft,
    lotSize: subjectLotSize,
    yearBuilt: subjectYearBuilt,
    propertyType: formatHomeTypeAsPropertyType(subjectHomeType),
    latitude: subjectLat,
    longitude: subjectLng,
    photo: subjectPhoto,
  };

  // ---- Build comparables from all results (EXCLUDE subject address) ----
  const soldComparables: Comparable[] = [];
  const activeComparables: Comparable[] = [];
  const seenAddresses = new Set<string>();

  // Normalize subject address for exclusion matching
  const subjectAddrKey = subjectAddress.toLowerCase().trim().replace(/[,.]/g, "");

  for (const raw of rawResults) {
    const comp = parseRawComparable(raw, subjectLat, subjectLng);
    if (!comp) continue;

    // Deduplicate by address
    const key = comp.address.toLowerCase().trim();
    if (seenAddresses.has(key)) continue;

    // Exclude subject property from comparables table
    // (match by street/address — detail scraper returns exact match)
    const compAddrSimple = key.replace(/[,.]/g, "");
    if (
      compAddrSimple === subjectAddrKey ||
      compAddrSimple.startsWith(subjectAddrKey) ||
      subjectAddrKey.startsWith(compAddrSimple)
    ) continue;

    seenAddresses.add(key);

    if (comp.isSold) {
      soldComparables.push(comp);
    } else {
      activeComparables.push(comp);
    }
  }

  // ---- Score + filter BEFORE computing estimate ----
  // Score every comparable against the subject property so outliers
  // don't contaminate the estimate (e.g. $11M/30K sqft mansion).
  const allCompsUnsorted = [...soldComparables, ...activeComparables];
  const allPrices = allCompsUnsorted.map((c) => c.price).sort((a, b) => a - b);
  const rawMedian =
    allPrices.length > 0
      ? allPrices[Math.floor(allPrices.length / 2)]
      : 0;

  for (const comp of allCompsUnsorted) {
    let score = 1.0;

    // Beds: -0.08 per bed difference
    if (subjectBeds && comp.beds) {
      score -= Math.abs(comp.beds - subjectBeds) * 0.08;
    }

    // Baths: -0.06 per bath difference
    if (subjectBaths && comp.baths) {
      score -= Math.abs(comp.baths - subjectBaths) * 0.06;
    }

    // Sqft: progressive penalty
    if (subjectSqft && comp.sqft && subjectSqft > 0) {
      const sqftRatio = Math.abs(comp.sqft - subjectSqft) / subjectSqft;
      if (sqftRatio > 2.0) score -= 0.6;
      else if (sqftRatio > 1.0) score -= 0.35;
      else if (sqftRatio > 0.5) score -= 0.2;
      else score -= sqftRatio * 0.15;
    }

    // Distance: -0.05 per mile
    if (comp.distance != null) {
      score -= comp.distance * 0.05;
    }

    // Price outlier penalty
    if (rawMedian > 0 && comp.price > 0) {
      const priceRatio = Math.abs(comp.price - rawMedian) / rawMedian;
      if (priceRatio > 5.0) score -= 0.6;
      else if (priceRatio > 2.0) score -= 0.35;
      else if (priceRatio > 1.0) score -= 0.15;
      else if (priceRatio > 0.5) score -= 0.05;
    }

    comp.correlation = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }

  // Filter: only comps with correlation >= 0.35, top 20
  const MIN_CORRELATION = 0.35;
  const MAX_COMPS = 20;

  const allCompsScored = allCompsUnsorted
    .filter((c) => c.correlation >= MIN_CORRELATION)
    .sort((a, b) => b.correlation - a.correlation)
    .slice(0, MAX_COMPS);

  const filteredSold = allCompsScored.filter((c) => c.isSold);
  const filteredActive = allCompsScored.filter((c) => !c.isSold);

  // ---- Compute estimate from FILTERED comps only ----
  const compsWithSqft = allCompsScored.filter(
    (c) => c.price > 0 && c.sqft > 0
  );

  const filteredPrices = compsWithSqft
    .map((c) => c.price)
    .sort((a, b) => a - b);

  // Get Zestimate as sanity anchor (pulls estimate toward Zillow's own valuation)
  const zestimateVal: number | null = best.zestimate ?? null;

  let estimate: EstimateRange;

  if (filteredPrices.length >= 4 && subjectSqft && subjectSqft > 0) {
    const n = filteredPrices.length;

    // Weighted price-per-sqft from top-matching comps
    const ppsfEntries = compsWithSqft.map((c) => ({
      ppsf: c.price / c.sqft,
      weight: Math.max(0.1, 1 - Math.abs(c.sqft - subjectSqft) / subjectSqft),
    }));
    const totalWeight = ppsfEntries.reduce((s, e) => s + e.weight, 0);
    const weightedPpsf =
      ppsfEntries.reduce((s, e) => s + e.ppsf * e.weight, 0) / totalWeight;
    const perSqftEstimate = weightedPpsf * subjectSqft;

    // Median of filtered comps
    const median =
      n % 2 === 0
        ? (filteredPrices[n / 2 - 1] + filteredPrices[n / 2]) / 2
        : filteredPrices[Math.floor(n / 2)];

    // Blend: 50% per-sqft + 30% median + 20% Zestimate anchor
    // (if Zestimate available, otherwise 60/40)
    if (zestimateVal && zestimateVal > 0) {
      const blended = perSqftEstimate * 0.5 + median * 0.3 + zestimateVal * 0.2;
      estimate = {
        price: Math.round(blended),
        priceRangeLow: Math.round(filteredPrices[Math.floor(n * 0.1)]),
        priceRangeHigh: Math.round(filteredPrices[Math.floor(n * 0.9)]),
      };
    } else {
      const blended = perSqftEstimate * 0.6 + median * 0.4;
      estimate = {
        price: Math.round(blended),
        priceRangeLow: Math.round(filteredPrices[Math.floor(n * 0.1)]),
        priceRangeHigh: Math.round(filteredPrices[Math.floor(n * 0.9)]),
      };
    }
  } else if (filteredPrices.length >= 3) {
    // No subject sqft, use pure median
    const n = filteredPrices.length;
    const median =
      n % 2 === 0
        ? (filteredPrices[n / 2 - 1] + filteredPrices[n / 2]) / 2
        : filteredPrices[Math.floor(n / 2)];

    if (zestimateVal && zestimateVal > 0) {
      const blended = median * 0.7 + zestimateVal * 0.3;
      estimate = {
        price: Math.round(blended),
        priceRangeLow: Math.round(filteredPrices[Math.floor(n * 0.1)]),
        priceRangeHigh: Math.round(filteredPrices[Math.floor(n * 0.9)]),
      };
    } else {
      estimate = {
        price: Math.round(median),
        priceRangeLow: Math.round(filteredPrices[Math.floor(n * 0.1)]),
        priceRangeHigh: Math.round(filteredPrices[Math.floor(n * 0.9)]),
      };
    }
  } else {
    // 1-2 comps only
    const avg =
      filteredPrices.reduce((s, p) => s + p, 0) / (filteredPrices.length || 1);
    estimate = {
      price: Math.round(avg),
      priceRangeLow: Math.round(avg * 0.85),
      priceRangeHigh: Math.round(avg * 1.15),
    };
  }

  return {
    subjectProperty,
    estimate,
    soldComparables: filteredSold,
    activeComparables: filteredActive,
  };
}

/** Map Zillow homeType values to human-readable property type labels */
function formatHomeTypeAsPropertyType(homeType: string | null): string | null {
  if (!homeType) return null;
  const map: Record<string, string> = {
    SINGLE_FAMILY: "Single Family",
    CONDO: "Condo",
    TOWNHOUSE: "Townhouse",
    MULTI_FAMILY: "Multi-Family",
    MANUFACTURED: "Manufactured",
    APARTMENT: "Apartment",
    CO_OP: "Co-op",
    LAND: "Land",
    MOBILE: "Mobile",
  };
  return map[homeType.toUpperCase()] ?? homeType;
}

/** Compute distance in miles between two coordinate pairs using the Haversine formula */
function computeDistance(
  lat1: number | null,
  lng1: number | null,
  lat2: number | null,
  lng2: number | null
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
