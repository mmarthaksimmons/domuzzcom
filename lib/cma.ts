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
  // Detail scraper stores photos in responsivePhotos/originalPhotos arrays
  // with nested mixedSources.jpeg[].url
  let subjectPhoto: string | null = null;
  if (isDetailSubject) {
    // Try nested Zillow photo URLs first (not street view)
    const rp = best.responsivePhotos;
    const op = best.originalPhotos;
    if (Array.isArray(rp) && rp.length > 0) {
      subjectPhoto =
        rp[0]?.mixedSources?.jpeg?.[0]?.url ??
        rp[0]?.url ??
        null;
    }
    if (!subjectPhoto && Array.isArray(op) && op.length > 0) {
      subjectPhoto =
        op[0]?.mixedSources?.jpeg?.[0]?.url ??
        op[0]?.url ??
        null;
    }
    // Fallback: extract any photos.zillowstatic.com URL from raw JSON
    if (!subjectPhoto) {
      const raw = JSON.stringify(best);
      const match = raw.match(/https?:\/\/photos\.zillowstatic\.com\/[^"]+/);
      if (match) subjectPhoto = match[0];
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

  // ---- Compute estimate from all comparables ----
  // Blend median price with weighted price-per-sqft for size-adjusted value.
  const allCompsUnsorted = [...soldComparables, ...activeComparables];
  const compsWithSqft = allCompsUnsorted.filter(
    (c) => c.price > 0 && c.sqft > 0
  );

  const allCompPrices = compsWithSqft
    .map((c) => c.price)
    .sort((a, b) => a - b);

  let estimate: EstimateRange;

  if (allCompPrices.length >= 3 && subjectSqft && subjectSqft > 0) {
    const n = allCompPrices.length;

    // Raw median price (simple benchmark)
    const median =
      n % 2 === 0
        ? (allCompPrices[n / 2 - 1] + allCompPrices[n / 2]) / 2
        : allCompPrices[Math.floor(n / 2)];

    // Weighted price-per-sqft (size-adjusted value)
    // Weight each comp by how close its sqft is to subject
    const pricePerSqftEntries = compsWithSqft.map((c) => ({
      ppsf: c.price / c.sqft,
      weight: Math.max(
        0.1,
        1 - Math.abs(c.sqft - subjectSqft) / subjectSqft
      ),
    }));

    const totalWeight = pricePerSqftEntries.reduce((s, e) => s + e.weight, 0);
    const weightedPpsf =
      pricePerSqftEntries.reduce((s, e) => s + e.ppsf * e.weight, 0) /
      totalWeight;

    const perSqftEstimate = weightedPpsf * subjectSqft;

    // Blend: 60% per-sqft estimate + 40% median — gives size-adjusted
    // value while anchoring to actual area pricing
    const blended = perSqftEstimate * 0.6 + median * 0.4;

    const low = allCompPrices[Math.floor(n * 0.1)];
    const high = allCompPrices[Math.floor(n * 0.9)];

    estimate = {
      price: Math.round(blended),
      priceRangeLow: Math.round(low),
      priceRangeHigh: Math.round(high),
    };
  } else if (allCompPrices.length >= 3) {
    // No subject sqft, fall back to pure median
    const n = allCompPrices.length;
    const median =
      n % 2 === 0
        ? (allCompPrices[n / 2 - 1] + allCompPrices[n / 2]) / 2
        : allCompPrices[Math.floor(n / 2)];
    estimate = {
      price: Math.round(median),
      priceRangeLow: Math.round(allCompPrices[Math.floor(n * 0.1)]),
      priceRangeHigh: Math.round(allCompPrices[Math.floor(n * 0.9)]),
    };
  } else {
    // 1-2 comps only
    const avg =
      allCompPrices.reduce((s, p) => s + p, 0) / allCompPrices.length;
    estimate = {
      price: Math.round(avg),
      priceRangeLow: Math.round(avg * 0.85),
      priceRangeHigh: Math.round(avg * 1.15),
    };
  }

  // ---- Compute correlation scores based on similarity to subject ----
  // Also compute median price of non-outlier comps for price-based filtering
  // (allCompsUnsorted was already built above in the estimate section)
  const allPrices = allCompsUnsorted.map((c) => c.price).sort((a, b) => a - b);
  const medianPrice =
    allPrices.length > 0
      ? allPrices[Math.floor(allPrices.length / 2)]
      : estimate.price;

  for (const comp of allCompsUnsorted) {
    let score = 1.0;

    // Beds: -0.07 per bed difference
    if (subjectBeds && comp.beds) {
      score -= Math.abs(comp.beds - subjectBeds) * 0.07;
    }

    // Baths: -0.05 per bath difference
    if (subjectBaths && comp.baths) {
      score -= Math.abs(comp.baths - subjectBaths) * 0.05;
    }

    // Sqft: heavy penalty if >50% different, very heavy if >100%
    if (subjectSqft && comp.sqft && subjectSqft > 0) {
      const sqftRatio = Math.abs(comp.sqft - subjectSqft) / subjectSqft;
      if (sqftRatio > 1.0) {
        score -= 0.5;
      } else if (sqftRatio > 0.5) {
        score -= 0.25;
      } else {
        score -= sqftRatio * 0.15;
      }
    }

    // Distance: -0.04 per mile
    if (comp.distance != null) {
      score -= comp.distance * 0.04;
    }

    // Price divergence from median: heavy penalty for extreme outliers
    if (medianPrice > 0 && comp.price > 0) {
      const priceRatio = Math.abs(comp.price - medianPrice) / medianPrice;
      if (priceRatio > 3.0) {
        score -= 0.5; // extreme outlier like $11M in a $300K area
      } else if (priceRatio > 1.0) {
        score -= 0.2;
      } else if (priceRatio > 0.5) {
        score -= 0.1;
      }
    }

    comp.correlation = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }

  // Filter to top 20 comparables by correlation, min threshold 0.25
  const MIN_CORRELATION = 0.25;
  const MAX_COMPS = 20;

  const allCompsScored = allCompsUnsorted
    .filter((c) => c.correlation >= MIN_CORRELATION)
    .sort((a, b) => b.correlation - a.correlation)
    .slice(0, MAX_COMPS);

  // Re-split into sold / active after filtering
  const filteredSold = allCompsScored.filter((c) => c.isSold);
  const filteredActive = allCompsScored.filter((c) => !c.isSold);

  // Recompute estimate from filtered sold comparables
  const filteredSoldPrices = filteredSold
    .map((c) => c.price)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);

  if (filteredSoldPrices.length >= 3) {
    const n = filteredSoldPrices.length;
    const median =
      n % 2 === 0
        ? (filteredSoldPrices[n / 2 - 1] + filteredSoldPrices[n / 2]) / 2
        : filteredSoldPrices[Math.floor(n / 2)];
    const low = filteredSoldPrices[Math.floor(n * 0.1)];
    const high = filteredSoldPrices[Math.floor(n * 0.9)];
    estimate = {
      price: Math.round(median),
      priceRangeLow: Math.round(low),
      priceRangeHigh: Math.round(high),
    };
  }
  // (if <3 sold, keep the previously computed estimate)

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
