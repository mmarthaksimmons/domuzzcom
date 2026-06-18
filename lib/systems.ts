import { House, SystemAgeEstimate } from "./types";

// ── Constants ──
/** Asphalt shingle roof lifespan (most common in US) */
const ROOF_LIFESPAN_ASPHALT = 25;
/** Metal roof lifespan */
const ROOF_LIFESPAN_METAL = 50;
/** Average HVAC lifespan (furnace + AC condenser) */
const HVAC_LIFESPAN = 18;
/** Average water heater lifespan */
const WATER_HEATER_LIFESPAN = 12;

/** Replacement cost per sqft for asphalt shingle roof (~$5.50/sqft is national average) */
const ROOF_COST_PER_SQFT = 5.5;
/** National average HVAC replacement cost (furnace + AC) */
const HVAC_REPLACEMENT_COST = 8500;
/** National average water heater replacement cost */
const WATER_HEATER_COST = 1800;

/** Number of years ahead to look for upcoming replacements */
const PREDICTION_WINDOW_YEARS = 5;

// ── Helpers ──
function classifyCondition(
  remainingLife: number | null,
  fullLifespan: number
): string | null {
  if (remainingLife == null) return null;
  if (remainingLife > 10) return "good";
  if (remainingLife > 5) return "fair";
  if (remainingLife >= 0) return "near-end";
  return "past-end";
}

/**
 * Get the roof lifespan based on house construction clues.
 * Default to asphalt shingle (25 years) — most common in US.
 * If the listing heating type hints at a newer build, we still default conservatively.
 */
function getRoofLifespan(_house: House): number {
  // Could be refined based on location, home type, etc.
  // For now, conservative default: asphalt shingle
  return ROOF_LIFESPAN_ASPHALT;
}

/**
 * Check if the listing description or status mentions recent
 * roof/HVAC work that would reset our age estimate.
 * This is intentionally conservative — we only "reset" if there's
 * explicit evidence of replacement.
 */
function findListingRenewalHints(_house: House): {
  roofReplaced: boolean;
  hvacReplaced: boolean;
} {
  // Could scan listing description for phrases like "new roof 2023",
  // "brand new HVAC", "recently replaced furnace", etc.
  // For now, no automated hint detection — defaults to worst-case
  return { roofReplaced: false, hvacReplaced: false };
}

// ── Main estimator ──

/**
 * Estimate the age and remaining life of major systems (roof, HVAC, water heater)
 * based on the house's year built and square footage.
 *
 * Uses conservative worst-case assumptions:
 * - Assumes systems are original from year-built unless there's listing evidence otherwise
 * - This protects the buyer: if a system was already replaced, they're pleasantly surprised
 */
export function estimateSystemAges(
  house: House,
  currentYear?: number
): SystemAgeEstimate {
  const now = currentYear ?? new Date().getFullYear();
  const yearBuilt = house.yearBuilt;
  const sqft = house.sqft ?? 1800; // fallback to average US home size
  const age = yearBuilt != null ? now - yearBuilt : null;

  const roofLifespan = getRoofLifespan(house);

  // Roof
  const roofAge = age;
  const roofRemainingLife =
    roofAge != null ? roofLifespan - roofAge : null;
  const roofReplacementEstimate = Math.round(sqft * ROOF_COST_PER_SQFT);
  const roofCondition = classifyCondition(roofRemainingLife, roofLifespan);

  // HVAC
  const hvacAge = age;
  const hvacRemainingLife =
    hvacAge != null ? HVAC_LIFESPAN - hvacAge : null;
  const hvacReplacementEstimate = HVAC_REPLACEMENT_COST;
  const hvacCondition = classifyCondition(hvacRemainingLife, HVAC_LIFESPAN);

  // Water heater — assume replaced on a cycle (every WATER_HEATER_LIFESPAN years)
  // If house is 31 years old, water heater is ~31 % 12 = 7 years old
  const whAge =
    age != null ? age % WATER_HEATER_LIFESPAN : null;
  const whRemainingLife =
    whAge != null ? WATER_HEATER_LIFESPAN - whAge : null;
  const whReplacementEstimate = WATER_HEATER_COST;
  const whCondition = classifyCondition(whRemainingLife, WATER_HEATER_LIFESPAN);

  // Total big repairs likely in next PREDICTION_WINDOW_YEARS
  let totalRepairs = 0;
  if (roofRemainingLife != null && roofRemainingLife <= PREDICTION_WINDOW_YEARS) {
    totalRepairs += roofReplacementEstimate;
  }
  if (hvacRemainingLife != null && hvacRemainingLife <= PREDICTION_WINDOW_YEARS) {
    totalRepairs += hvacReplacementEstimate;
  }
  if (whRemainingLife != null && whRemainingLife <= PREDICTION_WINDOW_YEARS) {
    totalRepairs += whReplacementEstimate;
  }

  // Risk level
  const risk =
    totalRepairs > 15000
      ? "critical"
      : totalRepairs > 8000
        ? "high"
        : totalRepairs > 3000
          ? "moderate"
          : "low";

  return {
    roofAge,
    roofRemainingLife,
    roofReplacementEstimate,
    roofCondition,

    hvacAge,
    hvacRemainingLife,
    hvacReplacementEstimate,
    hvacCondition,

    waterHeaterAge: whAge,
    waterHeaterRemainingLife: whRemainingLife,
    waterHeaterReplacementEstimate: whReplacementEstimate,
    waterHeaterCondition: whCondition,

    totalEstimatedBigRepairs: totalRepairs,
    bigTicketRisk: risk,
  };
}