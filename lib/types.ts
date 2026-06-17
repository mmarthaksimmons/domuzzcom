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
