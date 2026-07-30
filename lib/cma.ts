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
  /** Date the property was listed (ISO string) */
  listedDate: string | null;
  /** Date the property was sold/closed (ISO string) */
  soldDate: string | null;
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
  /** Confidence level based on tight-tier comp count */
  confidence?: "low" | "medium" | "high";
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
    const isSold = isSoldStatus(comp.status);
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
      isSold,
      latitude: comp.latitude ?? null,
      longitude: comp.longitude ?? null,
      listedDate: comp.listedDate ?? null,
      soldDate: isSold ? (comp.removedDate ?? comp.lastSeenDate ?? null) : null,
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
 */
function parseRawComparable(
  raw: any,
  subjectLat: number | null,
  subjectLng: number | null
): Comparable | null {
  const isDetail = raw.address && typeof raw.address === "object";

  const compAddress: string = isDetail
    ? (raw.address.streetAddress ?? raw.abbreviatedAddress ?? "")
    : (raw.address ?? "");

  const compPrice: number | null = isDetail
    ? raw.price
    : (raw.unformattedPrice ?? null);
  if (!compPrice || compPrice <= 0) return null;

  const compStatus: string | null = isDetail
    ? (raw.homeStatus ?? raw.statusText ?? null)
    : (raw.statusType ?? raw.statusText ?? null);

  const isSold =
    compStatus === "SOLD" ||
    compStatus === "Sold" ||
    compStatus === "FOR_SALE_CLOSED" ||
    compStatus === "OTHER" ||
    (typeof compStatus === "string" && compStatus.toLowerCase().includes("sold"));

  const compBeds: number = (isDetail ? raw.bedrooms : raw.beds) ?? 0;
  const compBaths: number = (isDetail ? raw.bathrooms : raw.baths) ?? 0;
  const compSqft: number = (isDetail
    ? (raw.livingArea ?? raw.livingAreaValue)
    : raw.area) ?? 0;

  const hdpType = raw.hdpData?.homeInfo?.homeType;
  const rawType = isDetail
    ? (raw.homeType ?? raw.propertyType)
    : (hdpType ?? raw.homeType ?? raw.propertyType);
  const compPropertyType = formatHomeTypeAsPropertyType(rawType);

  const compYearBuilt: number | null = isDetail
    ? raw.yearBuilt
    : (hdpType ? raw.hdpData?.homeInfo?.yearBuilt : null) ?? null;
  let compLotSize: number | null = null;
  if (isDetail) {
    const rawLotValue = raw.lotAreaValue ?? raw.lotSize;
    if (rawLotValue != null) {
      const lotUnits: string | undefined = raw.lotAreaUnits;
      if (lotUnits === "Acres") {
        compLotSize = Number(rawLotValue) * 43560;
      } else {
        compLotSize = Number(rawLotValue);
      }
    }
  }

  const compLat: number | null = isDetail
    ? (raw.latitude ?? raw.lat)
    : raw.latLong?.latitude ?? null;
  const compLng: number | null = isDetail
    ? (raw.longitude ?? raw.lng)
    : raw.latLong?.longitude ?? null;

  let compDom: number | null = null;
  if (isDetail) {
    compDom = raw.daysOnZillow ?? null;
  } else {
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

  const dist = computeDistance(subjectLat, subjectLng, compLat, compLng);

  // Extract dates for Apify detail and search scraper schemas
  let compListedDate: string | null = null;
  let compSoldDate: string | null = null;
  if (isDetail) {
    compListedDate = raw.datePosted ?? raw.listingDate ?? null;
    compSoldDate = raw.dateSold ?? raw.lastSoldDate ?? null;
  } else {
    compListedDate = raw.hdpData?.homeInfo?.datePosted ?? null;
    compSoldDate = raw.hdpData?.homeInfo?.dateSold ?? null;
  }

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
    listedDate: compListedDate,
    soldDate: compSoldDate,
  };
}

/**
 * Normalize Apify results (detail scraper + search scraper) into CMAReportData.
 * soldResults comes from the zip-search scraper (sold:true).
 */
export function normalizeApifyCmaResponse(
  address: string,
  rawResults: any[],
  soldResults?: any[]
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
  let subjectLotSize: number | null = null;
  if (isDetailSubject) {
    const rawLotValue = best.lotAreaValue ?? best.lotSize;
    if (rawLotValue != null) {
      const lotUnits: string | undefined = best.lotAreaUnits;
      if (lotUnits === "Acres") {
        subjectLotSize = Number(rawLotValue) * 43560;
      } else {
        subjectLotSize = Number(rawLotValue);
      }
    }
  }
  const subjectYearBuilt: number | null = best.yearBuilt ?? null;

  const hdpHomeType = best.hdpData?.homeInfo?.homeType;
  const subjectHomeType = isDetailSubject
    ? (best.homeType ?? best.propertyType)
    : (hdpHomeType ?? best.homeType ?? best.propertyType);

  // Extract photo: Google Street View Static API (primary), Zillow CDN (fallback)
  let subjectPhoto: string | null = null;

  // Primary: Google Street View Static API from lat/lng
  if (subjectLat != null && subjectLng != null) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      subjectPhoto = `https://maps.googleapis.com/maps/api/streetview?size=800x450&location=${subjectLat},${subjectLng}&key=${apiKey}&source=outdoor`;
    }
  }

  // Fallback: Zillow photo URLs (when coordinates are missing or no API key)
  if (!subjectPhoto) {
    if (isDetailSubject) {
      const raw = JSON.stringify(best);
      const matches = raw.match(/https?:\/\/photos\.zillowstatic\.com\/[^"\\]+/g);
      if (matches && matches.length > 0) {
        subjectPhoto =
          matches.find((u) => u.includes("cc_ft_1536"))
          ?? matches.find((u) => u.includes("cc_ft_1152"))
          ?? matches.find((u) => u.includes("cc_ft_960"))
          ?? matches[0];
      }
    } else {
      subjectPhoto = best.imgSrc ?? best.hdpData?.homeInfo?.photo ?? null;
    }
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

  // ---- Build comparables (EXCLUDE subject) ----
  const soldComparables: Comparable[] = [];
  const activeComparables: Comparable[] = [];
  const seenAddresses = new Set<string>();
  const subjectAddrKey = subjectAddress.toLowerCase().trim().replace(/[,.]/g, "");

  for (const raw of rawResults) {
    const comp = parseRawComparable(raw, subjectLat, subjectLng);
    if (!comp) continue;
    const key = comp.address.toLowerCase().trim();
    if (seenAddresses.has(key)) continue;
    const compAddrSimple = key.replace(/[,.]/g, "");
    if (
      compAddrSimple === subjectAddrKey ||
      compAddrSimple.startsWith(subjectAddrKey) ||
      subjectAddrKey.startsWith(compAddrSimple)
    ) continue;
    seenAddresses.add(key);
    // Filter active listings to same property type as subject
    if (
      !comp.isSold &&
      subjectHomeType &&
      comp.propertyType &&
      subjectHomeType.toUpperCase() !==
        (comp.propertyType === "Single Family"
          ? "SINGLE_FAMILY"
          : comp.propertyType === "Condo"
          ? "CONDO"
          : comp.propertyType === "Townhouse"
          ? "TOWNHOUSE"
          : comp.propertyType === "Multi-Family"
          ? "MULTI_FAMILY"
          : comp.propertyType === "Manufactured"
          ? "MANUFACTURED"
          : comp.propertyType.toUpperCase())
    ) {
      continue;
    }
    if (comp.isSold) soldComparables.push(comp);
    else activeComparables.push(comp);
  }

  // ---- Process zip-search SOLD results ----
  if (soldResults && soldResults.length > 0) {
    for (const raw of soldResults) {
      const compAddress = raw.address ?? raw.addressStreet ?? "";
      if (!compAddress) continue;
      const price = raw.unformattedPrice;
      if (!price || price <= 0) continue;
      const key = compAddress.toLowerCase().trim();
      if (seenAddresses.has(key)) continue;
      seenAddresses.add(key);
      const compAddrSimple = key.replace(/[,.]/g, "");
      if (
        compAddrSimple === subjectAddrKey ||
        compAddrSimple.startsWith(subjectAddrKey) ||
        subjectAddrKey.startsWith(compAddrSimple)
      ) continue;
      const compLat = raw.latLong?.latitude ?? null;
      const compLng = raw.latLong?.longitude ?? null;
      const dist = computeDistance(subjectLat, subjectLng, compLat, compLng);
      const compHdpHomeType = raw.hdpData?.homeInfo?.homeType;
      const compRawType = compHdpHomeType ?? raw.homeType ?? raw.propertyType;
      // Filter sold comps: must match subject property type
      if (subjectHomeType && compRawType) {
        const compLabel = formatHomeTypeAsPropertyType(compRawType);
        const subjectLabel = formatHomeTypeAsPropertyType(subjectHomeType);
        if (compLabel !== subjectLabel) continue;
      }
      soldComparables.push({
        address: compAddress,
        status: "SOLD",
        price: price,
        beds: raw.beds ?? 0,
        baths: raw.baths ?? 0,
        sqft: raw.area ?? 0,
        lotSize: null,
        yearBuilt: null,
        propertyType: formatHomeTypeAsPropertyType(compHdpHomeType ?? raw.homeType ?? raw.propertyType),
        distance: dist,
        daysOnMarket: raw.hdpData?.homeInfo?.daysOnZillow ?? null,
        correlation: 0.85,
        isSold: true,
        latitude: compLat,
        longitude: compLng,
        listedDate: null,
        soldDate: raw.hdpData?.homeInfo?.dateSold ?? null,
      });
    }
  }

  // ---- Score + filter ----
  // Correlation based on property characteristics (beds, baths, sqft,
  // distance) plus demand signals (sold status, DOM). Price deviation
  // from the raw median is NOT penalized because comps in different
  // price tiers can still be excellent matches.
  const allCompsUnsorted = [...soldComparables, ...activeComparables];

  for (const comp of allCompsUnsorted) {
    let score = 1.0;
    if (subjectBeds && comp.beds) score -= Math.abs(comp.beds - subjectBeds) * 0.08;
    if (subjectBaths && comp.baths) score -= Math.abs(comp.baths - subjectBaths) * 0.06;
    if (subjectSqft && comp.sqft && subjectSqft > 0) {
      const sqftRatio = Math.abs(comp.sqft - subjectSqft) / subjectSqft;
      if (sqftRatio > 2.0) score -= 0.6;
      else if (sqftRatio > 1.0) score -= 0.35;
      else if (sqftRatio > 0.5) score -= 0.2;
      else score -= sqftRatio * 0.15;
    }
    if (comp.distance != null) score -= comp.distance * 0.05;

    // Sold comps are stronger signals than active listings — they represent
    // real transactions, not aspirational asking prices.
    if (comp.isSold) score += 0.05;

    // Fast sales indicate strong demand. Very low DOM (≤7 days) at a sold
    // price confirms the market supports that price level.
    if (comp.isSold && comp.daysOnMarket != null && comp.daysOnMarket <= 7) {
      score += 0.04;
    } else if (comp.isSold && comp.daysOnMarket != null && comp.daysOnMarket <= 14) {
      score += 0.02;
    }

    comp.correlation = Math.max(0, Math.min(1, Math.round(score * 100) / 100));
  }

  const MIN_CORRELATION = 0.35;
  const MAX_PER_GROUP = 15;

  // Score and filter sold/active independently so each group gets its own slots
  const scoredSold = allCompsUnsorted
    .filter((c) => c.correlation >= MIN_CORRELATION && c.isSold)
    .sort((a, b) => b.correlation - a.correlation)
    .slice(0, MAX_PER_GROUP);

  const scoredActive = allCompsUnsorted
    .filter((c) => c.correlation >= MIN_CORRELATION && !c.isSold)
    .sort((a, b) => b.correlation - a.correlation)
    .slice(0, MAX_PER_GROUP);

  const allCompsScored = [...scoredSold, ...scoredActive]
    .sort((a, b) => b.correlation - a.correlation);

  const filteredSold = scoredSold;
  const filteredActive = scoredActive;

  // ---- Compute estimate from filtered comps ----
  // Tiered comp selection: prefer tight (close + high-correlation) comps.
  // Falls back through wider tiers when tight comps are scarce.
  const TIGHT_MIN_CORRELATION = 0.70;
  const TIGHT_MAX_DISTANCE_MILES = 2.0;
  const ESTIMATE_COMP_LIMIT = 6;
  const zestimateVal: number | null = best.zestimate ?? null;

  // Helper: filter comps to those with usable price + sqft
  const usable = (c: Comparable) => c.price > 0 && c.sqft > 0;

  // ---- Build tight comp set ----
  const tightComps = allCompsScored
    .filter((c) => usable(c) && c.correlation >= TIGHT_MIN_CORRELATION && c.distance != null && c.distance <= TIGHT_MAX_DISTANCE_MILES)
    .sort((a, b) => {
      // Sold before active, then correlation descending
      if (a.isSold !== b.isSold) return a.isSold ? -1 : 1;
      return b.correlation - a.correlation;
    });

  let selectedComps: Comparable[];
  let tightCount: number;

  if (tightComps.length >= 3) {
    // Tight tier: enough comps — use only these, capped
    selectedComps = tightComps.slice(0, ESTIMATE_COMP_LIMIT);
    tightCount = tightComps.length;
  } else if (tightComps.length >= 1) {
    // Sparse tight tier: widen to 3.5 mi + 0.55 correlation, merge
    const WIDENED_CORRELATION = 0.55;
    const WIDENED_DISTANCE = 3.5;
    const widenedComps = allCompsScored
      .filter((c) => usable(c) && c.correlation >= WIDENED_CORRELATION && c.distance != null && c.distance <= WIDENED_DISTANCE)
      .sort((a, b) => {
        if (a.isSold !== b.isSold) return a.isSold ? -1 : 1;
        return (a.distance ?? 99) - (b.distance ?? 99);
      });
    selectedComps = widenedComps.slice(0, ESTIMATE_COMP_LIMIT);
    tightCount = tightComps.length;
  } else {
    // No tight comps: fall back to top-by-correlation from full set
    console.warn("CMA: Low-confidence estimate — no tight comps found (correlation >= 0.70 within 2.0 mi)");
    selectedComps = allCompsScored
      .filter(usable)
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, ESTIMATE_COMP_LIMIT);
    tightCount = 0;
  }

  // ---- Outlier filtering on selected tier (BEFORE cap) ----
  const pricePerSqftValues = selectedComps.map((c) => c.price / c.sqft);
  const trimmedPricePerSqft = trimOutliersIQR(pricePerSqftValues, 2.0);
  const validPricePerSqftSet = new Set(trimmedPricePerSqft);
  const validComps = trimmedPricePerSqft.length >= 3
    ? selectedComps.filter((c) => validPricePerSqftSet.has(c.price / c.sqft))
    : selectedComps;
  const validPrices = validComps.map((c) => c.price).sort((a, b) => a - b);

  // ---- Compute estimate ----
  let estimate: EstimateRange;

  if (validComps.length === 0) {
    estimate = { price: 0, priceRangeLow: 0, priceRangeHigh: 0, confidence: "low" };
  } else if (validComps.length >= 4 && subjectSqft && subjectSqft > 0) {
    // Weighted blend with sold-status multiplier
    const scoredComps = validComps
      .map((c) => {
        const baseWeight =
          recencyWeight(c.daysOnMarket ?? 365) * 0.15 +
          distanceWeight(c.distance ?? undefined) * 0.20 +
          sqftSimilarityWeight(c.sqft, subjectSqft!) * 0.25 +
          c.correlation * c.correlation * 0.30;
        // Sold comps carry more weight than active listings (asking prices)
        const soldMultiplier = c.isSold ? 1.15 : 0.85;
        return { price: c.price, compositeWeight: baseWeight * soldMultiplier };
      });
    const sortedByPrice = [...scoredComps].sort((a, b) => a.price - b.price);
    const totalWeight = sortedByPrice.reduce((s, e) => s + e.compositeWeight, 0);
    let cumWeight = 0;
    let weightedMedian = sortedByPrice[0].price;
    for (const sc of sortedByPrice) {
      cumWeight += sc.compositeWeight;
      if (cumWeight >= totalWeight / 2) { weightedMedian = sc.price; break; }
    }
    const avgPrice = validPrices.reduce((s, p) => s + p, 0) / validPrices.length;
    const blended = zestimateVal && zestimateVal > 0
      ? weightedMedian * 0.50 + avgPrice * 0.30 + zestimateVal * 0.20
      : weightedMedian * 0.6 + avgPrice * 0.4;

    let priceRangeLow = Math.round(validPrices[Math.floor(validPrices.length * 0.1)]);
    let priceRangeHigh = Math.round(validPrices[Math.floor(validPrices.length * 0.9)]);

    // ---- Confidence & range sanity ----
    let confidence: "low" | "medium" | "high";
    if (tightCount >= 5) confidence = "high";
    else if (tightCount >= 3) confidence = "medium";
    else confidence = "low";

    const roundedPrice = Math.round(blended);
    // If range spans > 90% of point estimate, comp pool is too heterogeneous
    if (roundedPrice > 0 && (priceRangeHigh - priceRangeLow) / roundedPrice > 0.9) {
      priceRangeLow = Math.round(validPrices[Math.floor(validPrices.length * 0.25)]);
      priceRangeHigh = Math.round(validPrices[Math.floor(validPrices.length * 0.75)]);
    }

    estimate = { price: roundedPrice, priceRangeLow, priceRangeHigh, confidence };
  } else if (validComps.length >= 3) {
    const med = median(validPrices);
    const blended = zestimateVal && zestimateVal > 0 ? med * 0.80 + zestimateVal * 0.20 : med;
    let confidence: "low" | "medium" | "high";
    if (tightCount >= 5) confidence = "high";
    else if (tightCount >= 3) confidence = "medium";
    else confidence = "low";
    estimate = {
      price: Math.round(blended),
      priceRangeLow: Math.round(validPrices[Math.floor(validPrices.length * 0.1)]),
      priceRangeHigh: Math.round(validPrices[Math.floor(validPrices.length * 0.9)]),
      confidence,
    };
  } else {
    const avg = validPrices.reduce((s, p) => s + p, 0) / (validPrices.length || 1);
    estimate = {
      price: Math.round(avg),
      priceRangeLow: Math.round(avg * 0.85),
      priceRangeHigh: Math.round(avg * 1.15),
      confidence: "low",
    };
  }

  return { subjectProperty, estimate, soldComparables: filteredSold, activeComparables: filteredActive };
}

function formatHomeTypeAsPropertyType(homeType: string | null): string | null {
  if (!homeType) return null;
  const map: Record<string, string> = {
    SINGLE_FAMILY: "Single Family", CONDO: "Condo", TOWNHOUSE: "Townhouse",
    MULTI_FAMILY: "Multi-Family", MANUFACTURED: "Manufactured", APARTMENT: "Apartment",
    CO_OP: "Co-op", LAND: "Land", MOBILE: "Mobile",
  };
  return map[homeType.toUpperCase()] ?? homeType;
}

function recencyWeight(days: number): number { return Math.pow(0.5, days / 90); }
function distanceWeight(miles?: number): number { return miles == null ? 0.5 : Math.max(0.15, 1 - Math.min(miles, 1.5) / 1.5 * 0.85); }
function sqftSimilarityWeight(compSqft: number, subjectSqft: number): number {
  if (!subjectSqft || subjectSqft <= 0) return 0.5;
  return Math.max(0.1, 1 - Math.abs(compSqft - subjectSqft) / subjectSqft);
}
function trimOutliersIQR(values: number[], fenceMultiplier: number = 1.5): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  return sorted.filter((v) => v >= q1 - fenceMultiplier * iqr && v <= q3 + fenceMultiplier * iqr);
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
}

function computeDistance(lat1: number | null, lng1: number | null, lat2: number | null, lng2: number | null): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}