"use client";

import React, { useMemo } from "react";
import { House, Weights, UserProfile, NoGoFilters } from "@/lib/types";
import { calculateMortgage, MortgageEstimate, normalizeTaxRate } from "@/lib/mortgage";
import { AlertTriangle, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  houses: House[];
  weights: Weights;
  userProfile?: UserProfile | null;
  noGoViolations?: Record<string, string[]>;
}

function formatCurrency(val: number | null): string {
  if (val == null) return "—";
  return `$${val.toLocaleString()}`;
}

function formatPercentRaw(val: number | null): string {
  if (val == null) return "—";
  return `${val.toFixed(2)}%`;
}

function formatPercent(val: number | null): string {
  if (val == null) return "—";
  return `${(val * 100).toFixed(2)}%`;
}

function formatBool(val: boolean | null): string {
  if (val === null) return "—";
  return val ? "Yes" : "No";
}

function formatCondition(condition: string | null | undefined): string {
  if (!condition) return "—";
  switch (condition) {
    case "good": return "Good";
    case "fair": return "Fair";
    case "near-end": return "Near End";
    case "past-end": return "Past End";
    default: return condition;
  }
}

function formatRisk(risk: string | null | undefined): string {
  if (!risk) return "—";
  switch (risk) {
    case "low": return "Low";
    case "moderate": return "Moderate";
    case "high": return "High";
    case "critical": return "Critical";
    default: return risk;
  }
}

function formatLabel(val: string | null | undefined): string {
  if (!val) return "—";
  return val
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSchools(schools: { name: string; rating: number | null }[]): string {
  if (!schools || schools.length === 0) return "—";
  return schools
    .map((s) => `${s.name} (${s.rating != null ? s.rating + "/10" : "NR"})`)
    .join("\n");
}

function bestValue(
  houses: House[],
  extractor: (h: House) => number | null | undefined,
  higherBetter: boolean
): number | null {
  const vals = houses.map(extractor).filter((v) => v != null && !isNaN(v)) as number[];
  if (vals.length === 0) return null;
  return higherBetter ? Math.max(...vals) : Math.min(...vals);
}

function isBest(
  val: number | null | undefined,
  best: number | null,
  higherBetter: boolean
): boolean {
  if (val == null || best == null) return false;
  return higherBetter ? val >= best : val <= best;
}

function topSchoolRating(schools: { rating: number | null }[]): number {
  const ratings = schools.map((s) => s.rating).filter((r) => r != null) as number[];
  return ratings.length > 0 ? Math.max(...ratings) : 0;
}

// ---------- Data-driven weighted scoring ----------

interface ScoredCriterion {
  key: string;
  label: string;
  extract: (ctx: { house: House; mort: MortgageEstimate | null }) => number | null;
  defaultMax: number;
  higherBetter: boolean;
}

function buildCriteria(userProfile?: UserProfile | null): ScoredCriterion[] {
  return [
    {
      key: "price",
      label: "Price",
      extract: ({ house }) => house.price,
      defaultMax: 1_500_000,
      higherBetter: false,
    },
    {
      key: "monthlyPayment",
      label: "Monthly Payment",
      extract: ({ mort }) => mort?.monthlyPayment ?? null,
      defaultMax: 10_000,
      higherBetter: false,
    },
    {
      key: "annualTax",
      label: "Annual Tax",
      extract: ({ mort }) => mort?.annualTax ?? null,
      defaultMax: 20_000,
      higherBetter: false,
    },
    {
      key: "annualInsurance",
      label: "Annual Insurance",
      extract: ({ mort }) => mort?.annualInsurance ?? null,
      defaultMax: 5_000,
      higherBetter: false,
    },
    {
      key: "dtiRatio",
      label: "DTI Ratio",
      extract: ({ mort }) =>
        mort?.dtiRatio != null ? mort.dtiRatio * 100 : null,
      defaultMax: 50,
      higherBetter: false,
    },
    {
      key: "downPayment",
      label: "Down Payment",
      extract: ({ mort }) => mort?.cashNeeded.downPayment ?? null,
      defaultMax: 400_000,
      higherBetter: false,
    },
    {
      key: "schools",
      label: "Schools",
      extract: ({ house }) => topSchoolRating(house.schools),
      defaultMax: 10,
      higherBetter: true,
    },
    {
      key: "size",
      label: "Square Footage",
      extract: ({ house }) => house.sqft,
      defaultMax: 5_000,
      higherBetter: true,
    },
    {
      key: "taxes",
      label: "Tax Rate",
      extract: ({ house }) => normalizeTaxRate(house.propertyTaxRate),
      defaultMax: 0.03,
      higherBetter: false,
    },
    {
      key: "yearBuilt",
      label: "Year Built",
      extract: ({ house }) => house.yearBuilt,
      defaultMax: new Date().getFullYear(),
      higherBetter: true,
    },
    {
      key: "lotSize",
      label: "Lot Size",
      extract: ({ house }) => {
        if (!house.lotSize) return null;
        const acresMatch = house.lotSize.match(/([\d.]+)\s*acres?/i);
        if (acresMatch) return parseFloat(acresMatch[1]) * 43560;
        const sqftMatch = house.lotSize.match(/([\d,]+)\s*sq\s*ft/i);
        if (sqftMatch) return parseFloat(sqftMatch[1].replace(/,/g, ""));
        return null;
      },
      defaultMax: 43_560,
      higherBetter: true,
    },
    {
      key: "hoa",
      label: "HOA Fee",
      extract: ({ house }) => house.hoaMonthly,
      defaultMax: 500,
      higherBetter: false,
    },
    {
      key: "pricePerSqft",
      label: "Price/Sqft",
      extract: ({ house }) => house.pricePerSqft,
      defaultMax: 500,
      higherBetter: false,
    },
    {
      key: "daysOnZillow",
      label: "Days Listed",
      extract: ({ house }) => house.daysOnZillow,
      defaultMax: 365,
      higherBetter: false,
    },
    {
      key: "beds",
      label: "Bedrooms",
      extract: ({ house }) => house.beds,
      defaultMax: 6,
      higherBetter: true,
    },
    {
      key: "baths",
      label: "Bathrooms",
      extract: ({ house }) => house.baths,
      defaultMax: 5,
      higherBetter: true,
    },
    {
      key: "garage",
      label: "Garage Spaces",
      extract: ({ house }) => house.garage,
      defaultMax: 4,
      higherBetter: true,
    },
    {
      key: "stories",
      label: "Stories",
      extract: ({ house }) => house.stories,
      defaultMax: 3,
      higherBetter: true,
    },
    {
      key: "bigTicketRisk",
      label: "Big-Ticket Needs",
      extract: ({ house }) => house.systemAges?.totalEstimatedBigRepairs ?? null,
      defaultMax: 30000,
      higherBetter: false,
    },
  ];
}

function weightedScore(
  house: House,
  mort: MortgageEstimate | null,
  weights: Weights,
  criteria: ScoredCriterion[]
): number {
  let totalWeight = 0;
  let totalScore = 0;

  for (const c of criteria) {
    const w = weights[c.key];
    const effectiveWeight = w ?? 3;
    if (effectiveWeight <= 0) continue;

    const val = c.extract({ house, mort });
    if (val == null || isNaN(val)) continue;

    let norm = Math.min(val / c.defaultMax, 1);
    if (!c.higherBetter) norm = 1 - norm;
    norm = Math.max(norm, 0);

    totalScore += norm * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  return totalWeight > 0 ? (totalScore / totalWeight) * 10 : 0;
}

// ---------- Table row definitions ----------

interface TableRowDef {
  label: string;
  fieldKey?: keyof House;
  extract?: (ctx: { house: House; mort: MortgageEstimate | null }) => string | number | null;
  format?: "currency" | "percent" | "number" | "bool" | "string" | "condition" | "risk";
  higherBetter?: boolean;
}

interface SectionDef {
  label: string;
  rows: TableRowDef[];
}

function buildSections(): SectionDef[] {
  return [
    {
      label: "Overview",
      rows: [
        {
          label: "Home Type",
          extract: ({ house }) => formatLabel(house.homeType),
          format: "string",
        },
        {
          label: "Status",
          extract: ({ house }) => formatLabel(house.status),
          format: "string",
        },
        { label: "Price", fieldKey: "price", format: "currency", higherBetter: false },
        {
          label: "Est. Monthly Payment",
          extract: ({ mort }) => mort?.monthlyPayment ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "Est. Annual Tax",
          extract: ({ mort }) => mort?.annualTax ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "Est. Annual Insurance",
          extract: ({ mort }) => mort?.annualInsurance ?? null,
          format: "currency",
          higherBetter: false,
        },
      ],
    },
    {
      label: "Affordability",
      rows: [
        {
          label: "Interest Rate",
          extract: ({ mort }) =>
            mort?.interestRate != null ? mort.interestRate / 100 : null,
          format: "percent",
          higherBetter: false,
        },
        {
          label: "DTI Ratio",
          extract: ({ mort }) => mort?.dtiRatio ?? null,
          format: "percent",
          higherBetter: false,
        },
        {
          label: "Down Payment",
          extract: ({ mort }) => mort?.cashNeeded.downPayment ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "Cash Needed (incl. closing)",
          extract: ({ mort }) => mort?.cashNeeded.total ?? null,
          format: "currency",
          higherBetter: false,
        },
      ],
    },
    {
      label: "Size & Layout",
      rows: [
        { label: "Beds", fieldKey: "beds", higherBetter: true },
        { label: "Baths", fieldKey: "baths", higherBetter: true },
        { label: "Sqft", fieldKey: "sqft", higherBetter: true },
        {
          label: "Price/sqft",
          fieldKey: "pricePerSqft",
          format: "currency",
          higherBetter: false,
        },
        { label: "Lot Size", fieldKey: "lotSize", format: "string" },
        { label: "Stories", fieldKey: "stories", higherBetter: true },
        { label: "Year Built", fieldKey: "yearBuilt", higherBetter: true },
      ],
    },
    {
      label: "Features",
      rows: [
        { label: "Garage", fieldKey: "garage", format: "number", higherBetter: true },
        { label: "Pool", fieldKey: "hasPool", format: "bool" },
        { label: "Fireplace", fieldKey: "hasFireplace", format: "bool" },
        { label: "Heating", fieldKey: "heating", format: "string" },
        { label: "Cooling", fieldKey: "cooling", format: "string" },
      ],
    },
    {
      label: "Costs",
      rows: [
        { label: "HOA (Monthly)", fieldKey: "hoaMonthly", format: "currency", higherBetter: false },
        {
          label: "Tax Rate",
          extract: ({ house }) => normalizeTaxRate(house.propertyTaxRate),
          format: "percent",
          higherBetter: false,
        },
        { label: "Days on Zillow", fieldKey: "daysOnZillow", higherBetter: false },
      ],
    },
    {
      label: "Major Systems",
      rows: [
        {
          label: "Roof Condition",
          extract: ({ house }) => house.systemAges?.roofCondition ?? null,
          format: "condition",
        },
        {
          label: "Roof Remaining Life",
          extract: ({ house }) => house.systemAges?.roofRemainingLife ?? null,
          format: "number",
          higherBetter: true,
        },
        {
          label: "Roof Repl. Cost",
          extract: ({ house }) => house.systemAges?.roofReplacementEstimate ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "HVAC Condition",
          extract: ({ house }) => house.systemAges?.hvacCondition ?? null,
          format: "condition",
        },
        {
          label: "HVAC Remaining Life",
          extract: ({ house }) => house.systemAges?.hvacRemainingLife ?? null,
          format: "number",
          higherBetter: true,
        },
        {
          label: "HVAC Repl. Cost",
          extract: ({ house }) => house.systemAges?.hvacReplacementEstimate ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "Water Heater Condition",
          extract: ({ house }) => house.systemAges?.waterHeaterCondition ?? null,
          format: "condition",
        },
        {
          label: "WH Remaining Life",
          extract: ({ house }) => house.systemAges?.waterHeaterRemainingLife ?? null,
          format: "number",
          higherBetter: true,
        },
        {
          label: "WH Repl. Cost",
          extract: ({ house }) => house.systemAges?.waterHeaterReplacementEstimate ?? null,
          format: "currency",
          higherBetter: false,
        },
        {
          label: "Big-Ticket Risk",
          extract: ({ house }) => house.systemAges?.bigTicketRisk ?? null,
          format: "risk",
        },
        {
          label: "Est. 5yr Repairs",
          extract: ({ house }) => house.systemAges?.totalEstimatedBigRepairs ?? null,
          format: "currency",
          higherBetter: false,
        },
      ],
    },
    {
      label: "Schools",
      rows: [
        {
          label: "Nearby Schools",
          extract: ({ house }) => formatSchools(house.schools),
          format: "string",
        },
      ],
    },
  ];
}

export default function CompareTable({ houses, weights, userProfile, noGoViolations }: Props) {
  // Pre-calculate mortgages once
  const mortgages = useMemo(
    () => houses.map((h) => calculateMortgage(h, userProfile, userProfile?.renovationBudget ?? null)),
    [houses, userProfile]
  );

  const criteria = useMemo(
    () => buildCriteria(userProfile),
    [userProfile]
  );

  const sections = useMemo(() => buildSections(), []);

  const scores = useMemo(
    () => houses.map((h, i) => weightedScore(h, mortgages[i], weights, criteria)),
    [houses, mortgages, weights, criteria]
  );

  const bestScore = Math.max(...scores);
  const cheapestPrice = useMemo(
    () => Math.min(...houses.map((h) => h.price).filter((p): p is number => p != null)),
    [houses]
  );

  // Flatten sections into rows with section context
  const flatRows = useMemo(
    () =>
      sections.flatMap((sec) =>
        sec.rows.map((r) => ({
          ...r,
          sectionLabel: sec.label,
        }))
      ),
    [sections]
  );

  return (
    <div className="w-full overflow-x-auto pb-4">
      {/* Mobile scroll hint */}
      <div className="block sm:hidden px-4 py-2 text-xs text-muted-foreground text-center">
        ← Scroll to compare →
      </div>
      <div className="min-w-fit divide-y divide-border border-b">
        {/* Header Cards Row */}
        <div className="flex px-4 py-8 gap-4">
          <div className="w-[120px] sm:w-[180px] shrink-0" /> {/* Label column spacer */}
          {houses.map((h, i) => {
            const isBestValue = scores[i] === bestScore;
            const isCheapest = h.price === cheapestPrice;

            // Extract a short name for display. 
            // In a real app we might pass a title, here we just use the start of the address
            const shortName = h.address.split(",")[0] || "Property";
            
            return (
              <div key={i} className="w-[260px] sm:w-[280px] shrink-0 flex flex-col gap-3">
                {/* Header info */}
                <div className="flex flex-col gap-1.5 h-14">
                  <h3 className="font-bold text-lg leading-tight line-clamp-1">
                    {shortName}
                  </h3>
                  {isBestValue ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-pink-500 bg-pink-50/50 dark:bg-pink-950/20 px-2 py-0.5 rounded w-fit">
                      Best Value
                    </span>
                  ) : isCheapest && houses.length > 1 ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-green-500 bg-green-50/50 dark:bg-green-950/20 px-2 py-0.5 rounded w-fit">
                      Cheapest
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded w-fit">
                      Featured
                    </span>
                  )}
                </div>

                {/* Photo */}
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
                  {h.photo ? (
                    <img
                      src={h.photo}
                      alt={h.address}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                      No Photo
                    </div>
                  )}
                  {noGoViolations?.[h.address] && noGoViolations[h.address].length > 0 && (
                    <div className="absolute top-2 left-2 bg-destructive/90 text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-sm font-medium flex items-center gap-1 backdrop-blur-sm">
                      <XCircle className="w-3 h-3" />
                      Eliminated
                    </div>
                  )}
                  {/* Heart icon placeholder */}
                  <button className="absolute top-2 right-2 p-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors backdrop-blur-sm">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12.62 20.81C12.28 20.93 11.72 20.93 11.38 20.81C8.48 19.82 2 15.69 2 8.68998C2 5.59998 4.49 3.09998 7.56 3.09998C9.38 3.09998 10.99 3.97998 12 5.33998C13.01 3.97998 14.63 3.09998 16.44 3.09998C19.51 3.09998 22 5.59998 22 8.68998C22 15.69 15.52 19.82 12.62 20.81Z" fill="white"/>
                    </svg>
                  </button>
                </div>

                {/* Price and Action */}
                <div className="flex items-center justify-between mt-2">
                  <div className="font-bold text-lg">
                    {formatCurrency(h.price)}
                    <span className="text-sm font-normal text-muted-foreground"> price</span>
                  </div>
                  <button className="text-sm px-4 py-1.5 rounded-full border border-border font-medium hover:bg-muted transition-colors text-primary">
                    View
                  </button>
                </div>


                {/* Score */}
                <div className="mt-4 pt-4 border-t flex justify-between items-center bg-muted/30 -mx-3 px-3 py-2 rounded-lg">
                  <span className="text-sm font-medium">Match Score</span>
                  <span className={`font-bold ${isBestValue ? "text-green-600" : ""}`}>
                    {scores[i].toFixed(1)} <span className="text-muted-foreground font-normal text-sm">/ 10</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Rows */}
        <div className="flex flex-col gap-0 pb-8 mt-2">
          {flatRows.reduce<React.ReactElement[]>((acc, row, idx) => {
            // Section header when section changes
            const prevSection = idx > 0 ? flatRows[idx - 1].sectionLabel : null;
            if (row.sectionLabel !== prevSection) {
              acc.push(
                <div key={`sec-${row.sectionLabel}`} className="flex px-4 py-4 border-t border-border/60">
                  <div className="w-[120px] sm:w-[180px] shrink-0 flex items-center font-bold text-base sm:text-lg">
                    {row.sectionLabel}
                  </div>
                  {houses.map((_, i) => (
                    <div key={i} className="w-[260px] sm:w-[280px] shrink-0 ml-4" />
                  ))}
                </div>
              );
            }

            const extractor =
              row.extract ??
              ((ctx: { house: House; mort: MortgageEstimate | null }) => {
                const v = row.fieldKey ? ctx.house[row.fieldKey] : null;
                return v as string | number | null;
              });

            const isNumeric = row.format !== "string" && row.format !== "bool" && row.format !== "condition" && row.format !== "risk";
            const best = isNumeric
              ? bestValue(
                  houses,
                  (h) => {
                    const v = extractor({ house: h, mort: mortgages[houses.indexOf(h)] });
                    return typeof v === "number" ? v : null;
                  },
                  row.higherBetter ?? false
                )
              : null;

            acc.push(
              <div key={idx} className="flex px-4 py-4 hover:bg-muted/30 transition-colors">
                <div className="w-[120px] sm:w-[180px] shrink-0 text-xs sm:text-sm font-semibold flex items-center text-foreground flex-row gap-2 sm:gap-3">
                  <div className="w-1 h-3 bg-muted rounded-full shrink-0" />
                  {row.label}
                </div>
                {houses.map((h, i) => {
                  const raw = extractor({ house: h, mort: mortgages[i] });
                  const numVal = typeof raw === "number" ? raw : null;
                  const bestV = isBest(numVal, best, row.higherBetter ?? false);

                  let formatted: string;
                  if (raw == null || raw === undefined) {
                    formatted = "—";
                  } else if (row.format === "currency" && typeof raw === "number") {
                    formatted = formatCurrency(raw);
                  } else if (row.format === "percent" && typeof raw === "number") {
                    formatted = formatPercent(raw);
                  } else if (row.format === "bool") {
                    formatted = formatBool(typeof raw === "boolean" ? raw : null);
                  } else if (row.format === "condition") {
                    formatted = formatCondition(typeof raw === "string" ? raw : null);
                  } else if (row.format === "risk") {
                    formatted = formatRisk(typeof raw === "string" ? raw : null);
                  } else {
                    formatted = String(raw);
                  }

                  const conditionColor =
                    row.format === "condition" && raw === "good"
                      ? "text-green-600 font-semibold"
                      : row.format === "condition"
                        ? "text-red-600 font-semibold"
                        : row.format === "risk"
                          ? raw === "low"
                            ? "text-green-600 font-semibold"
                            : raw === "moderate"
                              ? "text-yellow-600 font-semibold"
                              : raw === "high"
                                ? "text-orange-600 font-semibold"
                                : "text-red-600 font-semibold"
                          : "";

                  return (
                    <div
                      key={i}
                      className={`w-[260px] sm:w-[280px] shrink-0 ml-4 text-xs sm:text-sm flex items-center whitespace-pre-line text-foreground/80 ${
                        isNumeric && bestV ? "text-green-600 font-semibold" : ""
                      } ${conditionColor}`}
                    >
                      {/* Optional visualization hook for beds/baths/etc based on row.fieldKey */}
                      {row.fieldKey === "beds" && (
                        <div className="flex items-center gap-3">
                           {/* Tiny inline photo thumbnail for visual flavor as in dribbble */}
                           <div className="w-10 h-7 bg-muted rounded overflow-hidden shadow-sm shrink-0">
                             {h.photo && <img src={h.photo} className="w-full h-full object-cover" />}
                           </div>
                           <div className="flex flex-col gap-0.5">
                             <span>{formatted} {formatted !== "—" && "bedrooms"}</span>
                             <span className="text-muted-foreground text-xs">{h.baths || 0} baths</span>
                           </div>
                        </div>
                      )}
                      {row.fieldKey !== "beds" && formatted}
                    </div>
                  );
                })}
              </div>
            );

            return acc;
          }, [])}
          
          {/* First-Year Cost Row */}
          {mortgages.some((m) => m.firstYearCost) && (
            <div className="flex px-4 py-4 bg-yellow-50/50 dark:bg-yellow-950/10">
              <div className="w-[120px] sm:w-[180px] shrink-0 text-xs sm:text-sm font-semibold flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Est. First-Year Cost
              </div>
              {mortgages.map((m, i) => (
                <div key={i} className="w-[260px] sm:w-[280px] shrink-0 ml-4 text-xs sm:text-sm flex items-center font-mono">
                  {m.firstYearCost?.totalFirstYear ? (
                    <span className="text-yellow-700 dark:text-yellow-400 font-semibold">
                      ${m.firstYearCost.totalFirstYear.toLocaleString()}
                    </span>
                  ) : "—"}
                </div>
              ))}
            </div>
          )}

          {/* No-Go Violations Rows */}
          {noGoViolations && Object.keys(noGoViolations).length > 0 && houses.map((h) => {
            const violations = noGoViolations[h.address];
            if (!violations || violations.length === 0) return null;
            
            return (
              <div key={`nogo-${h.address}`} className="flex px-4 py-4 bg-destructive/5">
                <div className="w-[120px] sm:w-[180px] shrink-0 text-xs sm:text-sm font-semibold flex items-center text-destructive">
                  🚫 Dealbreakers
                </div>
                {houses.map((_, i) => (
                  <div key={i} className="w-[260px] sm:w-[280px] shrink-0 ml-4 text-xs sm:text-sm flex items-center text-destructive font-medium">
                    {houses[i].address === h.address ? violations.join("; ") : "—"}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}