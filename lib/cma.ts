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
  };

  const estimate: EstimateRange = {
    price: data.price ?? 0,
    priceRangeLow: data.priceRangeLow ?? 0,
    priceRangeHigh: data.priceRangeHigh ?? 0,
  };

  const { sold, active } = filterComparables(comps);

  return { subjectProperty, estimate, soldComparables: sold, activeComparables: active };
}