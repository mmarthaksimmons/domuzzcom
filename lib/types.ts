export interface PriceHistoryEntry {
  date: string;
  event: string; // "Price change", "Sold", "Listed"
  price?: number;
  pricePerSquareFoot?: number;
}

export interface TaxHistoryEntry {
  year: number;
  value?: number;
  taxPaid?: number;
}

export interface SellingSoon {
  percentile: number; // e.g. 46 meaning "46% likely to sell soon"
  score?: number;
}

export interface ThirdPartyVirtualTour {
  externalUrl?: string;
  provider?: string;
}

export interface ResoFacts {
  flooring?: string | null;
  foundationDetails?: string | null;
  roofType?: string | null;
  sewer?: string | null;
  waterSource?: string | null;
  appliances?: string | null;
  constructionMaterials?: string | null;
  listingTerms?: string | null;
}

export interface SystemAgeEstimate {
  /** Estimated age of roof in years (null if unknown) */
  roofAge: number | null;
  /** Estimated remaining life for roof (years, negative = past end-of-life) */
  roofRemainingLife: number | null;
  /** Estimated replacement cost for roof */
  roofReplacementEstimate: number | null;
  /** Roof condition: "good" | "fair" | "near-end" | "past-end" */
  roofCondition: string | null;

  /** Estimated age of HVAC system */
  hvacAge: number | null;
  /** Estimated remaining life for HVAC */
  hvacRemainingLife: number | null;
  /** Estimated replacement cost for HVAC */
  hvacReplacementEstimate: number | null;
  /** HVAC condition */
  hvacCondition: string | null;

  /** Estimated age of water heater */
  waterHeaterAge: number | null;
  waterHeaterRemainingLife: number | null;
  waterHeaterReplacementEstimate: number | null;
  waterHeaterCondition: string | null;

  /** Sum of all big-ticket replacements likely needed in next 5 years */
  totalEstimatedBigRepairs: number;
  /** Risk level: "low" | "moderate" | "high" | "critical" */
  bigTicketRisk: string;
}

export interface House {
  address: string;
  price: number | null;
  status: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: string | null;
  yearBuilt: number | null;
  homeType: string | null;
  stories: number | null;
  pricePerSqft: number | null;
  hoaMonthly: number | null;
  propertyTaxRate: number | null;
  zestimate: number | null;
  rentZestimate: number | null;
  schools: { name: string; rating: number | null; level: string }[];
  garage: number | null;
  hasPool: boolean | null;
  hasFireplace: boolean | null;
  heating: string | null;
  cooling: string | null;
  daysOnZillow: number | null;
  photo: string | null;
  listingUrl: string;
  lat: number | null;
  lng: number | null;
  /** Age-based big-ticket system estimates (roof, HVAC, water heater) */
  systemAges?: SystemAgeEstimate;
  /** Price history events (Price change, Sold, Listed) */
  priceHistory?: PriceHistoryEntry[];
  /** Tax assessment history */
  taxHistory?: TaxHistoryEntry[];
  /** Annual homeowners insurance from listing */
  annualHomeownersInsurance?: number | null;
  /** Page view count on Zillow */
  pageViewCount?: number | null;
  /** Favorite/save count on Zillow */
  favoriteCount?: number | null;
  /** Third-party virtual tour URL */
  thirdPartyVirtualTour?: ThirdPartyVirtualTour | null;
  /** Selling soon prediction */
  sellingSoon?: SellingSoon | null;
  /** Additional RESO facts for Listing Intelligence */
  resoFactsExtended?: ResoFacts | null;
}

export type Weights = Record<string, number>; // e.g. { price: 5, schools: 4, size: 3, taxes: 3 }

/** Tier level for each priority criterion */
export type PriorityTier = "must" | "nice" | "bonus";

/** Maps each criterion key to its tier and optional threshold value */
export type TieredPriorities = Record<string, {
  tier: PriorityTier;
  threshold?: number; // minimum acceptable value for "must" tier (e.g. min beds = 3)
}>;

/** Binary dealbreaker filters — if any are triggered, the property is eliminated */
export interface NoGoFilters {
  noHoa: boolean;
  noOffStreetParking: boolean;
  minBeds: number | null;
  minBaths: number | null;
  minSqft: number | null;
  maxHoaMonthly: number | null;
  singleStoryOnly: boolean;
  noMajorIssues: boolean; // foundation, water damage, mold
}

export const DEFAULT_NO_GO: NoGoFilters = {
  noHoa: false,
  noOffStreetParking: false,
  minBeds: null,
  minBaths: null,
  minSqft: null,
  maxHoaMonthly: null,
  singleStoryOnly: false,
  noMajorIssues: false,
};

/** Renovation / first-year cost estimate */
export interface RenovationBudget {
  immediateRepairs: number;  // must-do fixes (roof, HVAC, etc.)
  desiredRenovations: number; // want-to-do updates
  annualMaintenancePercent: number; // default ~1% of home value
}

export interface UserProfile {
  income: number;       // annual income in USD
  creditScore: number;  // 300–850
  workAddress?: string; // for commute consideration
  renovationBudget?: RenovationBudget;
}

export interface AiResult {
  summary: string;
  perHouse: {
    address: string;
    pros: string[];
    cons: string[];
    score: number;
    monthlyEstimate?: number;
    affordabilityRating?: string;
    redFlags?: string[];       // foundation, water damage, mold, as-is, foreclosure
    firstYearCostEstimate?: number; // price + immediate repairs + desired renovations
  }[];
  recommendation: string;
  financialSummary?: string;
}

export interface CompareResponse {
  houses: House[];
  aiResult: AiResult | null;
  /** Per-property user notes */
  notes: Record<string, string>; // address → note text
  /** Violated no-go filters per property */
  noGoViolations: Record<string, string[]>; // address → list of violated rules
}
