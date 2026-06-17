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
  format?: "currency" | "percent" | "number" | "bool" | "string";
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
        { label: "Home Type", fieldKey: "homeType", format: "string" },
        { label: "Status", fieldKey: "status", format: "string" },
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
  const worstScore = scores.length > 1 ? Math.min(...scores) : bestScore;

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
    <div className="space-y-6">
      <Table>
        <TableHeader>
          <TableRow>
              <TableHead className="w-[140px] min-w-[120px]">Field</TableHead>
              {houses.map((h, i) => (
                <TableHead key={i} className="text-center min-w-[160px]">
                  <div className="text-sm font-semibold text-foreground line-clamp-2">
                    {h.address}
                  </div>
                  {noGoViolations?.[h.address] && noGoViolations[h.address].length > 0 && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <XCircle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] text-destructive font-medium">Eliminated</span>
                    </div>
                  )}
                </TableHead>
              ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Photo Row */}
          <TableRow>
            <TableCell className="font-medium text-xs py-2">Photo</TableCell>
            {houses.map((h, i) => (
              <TableCell key={i} className="text-center py-2">
                {h.photo ? (
                  <img
                    src={h.photo}
                    alt={h.address}
                    className="w-24 h-18 object-cover rounded-md mx-auto"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            ))}
          </TableRow>
          {flatRows.reduce<React.ReactElement[]>((acc, row, idx) => {
            // Section header when section changes
            const prevSection = idx > 0 ? flatRows[idx - 1].sectionLabel : null;
            if (row.sectionLabel !== prevSection) {
              acc.push(
                <TableRow key={`sec-${row.sectionLabel}`} className="bg-muted/30">
                  <TableCell
                    colSpan={houses.length + 1}
                    className="py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {row.sectionLabel}
                  </TableCell>
                </TableRow>
              );
            }

            const extractor =
              row.extract ??
              ((ctx: { house: House; mort: MortgageEstimate | null }) => {
                const v = row.fieldKey ? ctx.house[row.fieldKey] : null;
                return v as string | number | null;
              });

            const isNumeric = row.format !== "string" && row.format !== "bool";
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
              <TableRow key={idx}>
                <TableCell className="font-medium text-xs py-2">{row.label}</TableCell>
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
                  } else {
                    formatted = String(raw);
                  }

                  return (
                    <TableCell
                      key={i}
                      className={`text-center text-xs py-2 whitespace-pre-line ${
                        isNumeric && bestV ? "text-green-600 font-semibold" : ""
                      }`}
                    >
                      {formatted}
                    </TableCell>
                  );
                })}
              </TableRow>
            );

            return acc;
          }, [])}

          {/* Summary rows */}
          <TableRow className="bg-muted/20 border-t-2">
            <TableCell className="font-semibold text-sm">Weighted Score</TableCell>
            {houses.map((h, i) => (
              <TableCell
                key={i}
                className={`text-center font-bold text-sm ${
                  scores[i] === bestScore
                    ? "text-green-600"
                    : scores[i] === worstScore && houses.length > 1
                      ? "text-red-500"
                      : ""
                }`}
              >
                {scores[i].toFixed(1)} / 10
              </TableCell>
            ))}
          </TableRow>
          <TableRow className="bg-muted/10">
            <TableCell className="font-medium text-xs">Score Breakdown</TableCell>
            {houses.map((h, i) => {
              const delta = bestScore > 0 ? ((scores[i] - bestScore) / bestScore) * 100 : 0;
              return (
                <TableCell key={i} className="text-center text-xs text-muted-foreground">
                  {scores[i] === bestScore ? "🏆 Best" : `${delta.toFixed(0)}% below best`}
                </TableCell>
              );
            })}
          </TableRow>

          {/* First-Year Cost Row */}
          {mortgages.some((m) => m.firstYearCost) && (
            <TableRow className="bg-yellow-50/30 dark:bg-yellow-950/10">
              <TableCell className="font-medium text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                Est. First-Year Cost
              </TableCell>
              {mortgages.map((m, i) => (
                <TableCell
                  key={i}
                  className={`text-center text-xs font-mono ${
                    m.firstYearCost?.totalFirstYear
                      ? "text-yellow-700 dark:text-yellow-400 font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {m.firstYearCost?.totalFirstYear
                    ? `$${m.firstYearCost.totalFirstYear.toLocaleString()}`
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
          )}

          {/* No-Go Violations Rows */}
          {noGoViolations &&
            Object.keys(noGoViolations).length > 0 &&
            houses.map((h) => {
              const violations = noGoViolations[h.address];
              if (!violations || violations.length === 0) return null;
              return (
                <TableRow key={`nogo-${h.address}`} className="bg-destructive/5">
                  <TableCell className="text-[10px] text-destructive font-medium">
                    🚫 Dealbreakers
                  </TableCell>
                  {houses.map((_, i) => (
                    <TableCell key={i} className="text-center text-[10px] text-destructive">
                      {houses[i].address === h.address ? violations.join("; ") : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}