"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import CompareTable from "@/components/CompareTable";
import AiSummary from "@/components/AiSummary";
import BigTicketPanel from "@/components/BigTicketPanel";
import { House, Weights, CompareResponse, UserProfile } from "@/lib/types";
import { calculateMortgage, normalizeTaxRate } from "@/lib/mortgage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function ComparePage() {
  const router = useRouter();
  const [data, setData] = useState<CompareResponse | null>(null);
  const [weights, setWeights] = useState<Weights>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [noGoViolations, setNoGoViolations] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = sessionStorage.getItem("compareResult");
    const storedWeights = sessionStorage.getItem("compareWeights");
    const storedProfile = sessionStorage.getItem("compareUserProfile");

    if (!stored) {
      router.push("/");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as CompareResponse;
      setData(parsed);
      setWeights(storedWeights ? JSON.parse(storedWeights) : {});
      if (storedProfile) {
        setUserProfile(JSON.parse(storedProfile) as UserProfile);
      }
      if (parsed.noGoViolations) {
        setNoGoViolations(parsed.noGoViolations);
      }
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Pre-calc mortgages for CSV export
  const mortgages = useMemo(
    () => (data ? data.houses.map((h) => calculateMortgage(h, userProfile)) : []),
    [data, userProfile]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading comparison data...</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No comparison data found.</p>
          <Button onClick={() => router.push("/")}>
            Start a new comparison
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
          <div className="flex items-center">
            <Image
              src="/domuzz_logo.png"
              alt="Domuzz - Property Comparison"
              width={140}
              height={32}
              priority
              className="h-auto w-auto sm:w-[180px]"
            />
          </div>
          <Button
            variant="link"
            size="sm"
            className="self-start sm:self-auto px-0 sm:px-3"
            onClick={() => {
              sessionStorage.removeItem("compareResult");
              sessionStorage.removeItem("compareWeights");
              sessionStorage.removeItem("compareUserProfile");
              router.push("/");
            }}
          >
            ← New Comparison
          </Button>
        </div>

        {/* Comparison Table */}
        <Card className="overflow-hidden mb-6">
          <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-foreground">Comparison Results</h2>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                // ── Helpers matching CompareTable formatting ──
                const csvEscape = (val: string) =>
                  val.includes(",") || val.includes('"') || val.includes("\n")
                    ? `"${val.replace(/"/g, '""')}"`
                    : val;
                const fmtCur = (v: number | null) =>
                  v != null ? `$${v.toLocaleString()}` : "—";
                const fmtPct = (v: number | null) =>
                  v != null ? `${(v * 100).toFixed(2)}%` : "—";
                const fmtBool = (v: boolean | null) =>
                  v === null ? "—" : v ? "Yes" : "No";
                const fmtSchools = (
                  schools: { name: string; rating: number | null }[]
                ) =>
                  schools.length === 0
                    ? "—"
                    : schools
                        .map(
                          (s) =>
                            `${s.name} (${s.rating != null ? s.rating + "/10" : "NR"})`
                        )
                        .join("\n");

                // ── Weighted scores (matching CompareTable logic) ──
                const buildCriteria = () => [
                  {
                    key: "price",
                    extract: (h: House) => h.price,
                    defaultMax: 1_500_000,
                    higherBetter: false,
                  },
                  {
                    key: "monthlyPayment",
                    extract: (_h: House, m: ReturnType<typeof calculateMortgage> | null) =>
                      m?.monthlyPayment ?? null,
                    defaultMax: 10_000,
                    higherBetter: false,
                  },
                  {
                    key: "annualTax",
                    extract: (_h: House, m: ReturnType<typeof calculateMortgage> | null) =>
                      m?.annualTax ?? null,
                    defaultMax: 20_000,
                    higherBetter: false,
                  },
                  {
                    key: "annualInsurance",
                    extract: (_h: House, m: ReturnType<typeof calculateMortgage> | null) =>
                      m?.annualInsurance ?? null,
                    defaultMax: 5_000,
                    higherBetter: false,
                  },
                  {
                    key: "dtiRatio",
                    extract: (_h: House, m: ReturnType<typeof calculateMortgage> | null) =>
                      m?.dtiRatio != null ? m.dtiRatio * 100 : null,
                    defaultMax: 50,
                    higherBetter: false,
                  },
                  {
                    key: "downPayment",
                    extract: (_h: House, m: ReturnType<typeof calculateMortgage> | null) =>
                      m?.cashNeeded.downPayment ?? null,
                    defaultMax: 400_000,
                    higherBetter: false,
                  },
                  {
                    key: "schools",
                    extract: (h: House) => {
                      const ratings = h.schools
                        .map((s) => s.rating)
                        .filter((r) => r != null) as number[];
                      return ratings.length > 0 ? Math.max(...ratings) : 0;
                    },
                    defaultMax: 10,
                    higherBetter: true,
                  },
                  {
                    key: "size",
                    extract: (h: House) => h.sqft,
                    defaultMax: 5_000,
                    higherBetter: true,
                  },
                  {
                    key: "taxes",
                    extract: (h: House) => normalizeTaxRate(h.propertyTaxRate),
                    defaultMax: 0.03,
                    higherBetter: false,
                  },
                  {
                    key: "yearBuilt",
                    extract: (h: House) => h.yearBuilt,
                    defaultMax: new Date().getFullYear(),
                    higherBetter: true,
                  },
                  {
                    key: "lotSize",
                    extract: (h: House) => {
                      if (!h.lotSize) return null;
                      const acresMatch = h.lotSize.match(/([\d.]+)\s*acres?/i);
                      if (acresMatch)
                        return parseFloat(acresMatch[1]) * 43560;
                      const sqftMatch = h.lotSize.match(/([\d,]+)\s*sq\s*ft/i);
                      if (sqftMatch)
                        return parseFloat(sqftMatch[1].replace(/,/g, ""));
                      return null;
                    },
                    defaultMax: 43_560,
                    higherBetter: true,
                  },
                  {
                    key: "hoa",
                    extract: (h: House) => h.hoaMonthly,
                    defaultMax: 500,
                    higherBetter: false,
                  },
                  {
                    key: "pricePerSqft",
                    extract: (h: House) => h.pricePerSqft,
                    defaultMax: 500,
                    higherBetter: false,
                  },
                  {
                    key: "daysOnZillow",
                    extract: (h: House) => h.daysOnZillow,
                    defaultMax: 365,
                    higherBetter: false,
                  },
                  {
                    key: "beds",
                    extract: (h: House) => h.beds,
                    defaultMax: 6,
                    higherBetter: true,
                  },
                  {
                    key: "baths",
                    extract: (h: House) => h.baths,
                    defaultMax: 5,
                    higherBetter: true,
                  },
                  {
                    key: "garage",
                    extract: (h: House) => h.garage,
                    defaultMax: 4,
                    higherBetter: true,
                  },
                  {
                    key: "stories",
                    extract: (h: House) => h.stories,
                    defaultMax: 3,
                    higherBetter: true,
                  },
                  {
                    key: "bigTicketRisk",
                    extract: (h: House) => h.systemAges?.totalEstimatedBigRepairs ?? null,
                    defaultMax: 30000,
                    higherBetter: false,
                  },
                ];

                const criteria = buildCriteria();
                const scores = data.houses.map((h, i) => {
                  let totalW = 0;
                  let totalS = 0;
                  for (const c of criteria) {
                    const w = weights[c.key] ?? 3;
                    if (w <= 0) continue;
                    const val = c.extract(h, mortgages[i]);
                    if (val == null || isNaN(val)) continue;
                    let norm = Math.min(val / c.defaultMax, 1);
                    if (!c.higherBetter) norm = 1 - norm;
                    norm = Math.max(norm, 0);
                    totalS += norm * w;
                    totalW += w;
                  }
                  return totalW > 0 ? (totalS / totalW) * 10 : 0;
                });
                const bestScore = Math.max(...scores);
                const worstScore =
                  scores.length > 1 ? Math.min(...scores) : bestScore;

                const houseAddrs = data.houses.map((h) => `"${h.address}"`);

                // ── Build transposed CSV rows (fields as rows, houses as columns) ──
                const csvRows: string[] = [];

                // Header row: Field, House1, House2, ...
                csvRows.push(["Field", ...houseAddrs].join(","));

                // Section helper
                const pushSection = (label: string) => {
                  csvRows.push(
                    [`"${label}"`, ...houseAddrs.map(() => "")].join(",")
                  );
                };

                // Photo row
                csvRows.push(
                  [
                    "Photo",
                    ...data.houses.map((h) => `"${h.photo ?? "—"}"`),
                  ].join(",")
                );

                // ── Overview ──
                pushSection("--- Overview ---");
                csvRows.push(
                  [
                    "Home Type",
                    ...data.houses.map((h) => h.homeType ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Status",
                    ...data.houses.map((h) => h.status ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Price",
                    ...data.houses.map((h) => csvEscape(fmtCur(h.price))),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Est. Monthly Payment",
                    ...data.houses.map((_, i) =>
                      csvEscape(fmtCur(mortgages[i]?.monthlyPayment ?? null))
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Est. Annual Tax",
                    ...data.houses.map((_, i) =>
                      csvEscape(fmtCur(mortgages[i]?.annualTax ?? null))
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Est. Annual Insurance",
                    ...data.houses.map((_, i) =>
                      csvEscape(fmtCur(mortgages[i]?.annualInsurance ?? null))
                    ),
                  ].join(",")
                );

                // ── Affordability ──
                pushSection("--- Affordability ---");
                csvRows.push(
                  [
                    "Interest Rate",
                    ...data.houses.map((_, i) =>
                      mortgages[i]
                        ? `${mortgages[i].interestRate.toFixed(2)}%`
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "DTI Ratio",
                    ...data.houses.map((_, i) => {
                      const d = mortgages[i]?.dtiRatio;
                      return d != null ? `${(d * 100).toFixed(2)}%` : "—";
                    }),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Down Payment",
                    ...data.houses.map((_, i) =>
                      csvEscape(fmtCur(mortgages[i]?.cashNeeded.downPayment ?? null))
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Cash Needed (incl. closing)",
                    ...data.houses.map((_, i) =>
                      csvEscape(fmtCur(mortgages[i]?.cashNeeded.total ?? null))
                    ),
                  ].join(",")
                );

                // ── Size & Layout ──
                pushSection("--- Size & Layout ---");
                csvRows.push(
                  [
                    "Beds",
                    ...data.houses.map((h) => h.beds ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Baths",
                    ...data.houses.map((h) => h.baths ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Sqft",
                    ...data.houses.map((h) =>
                      h.sqft != null ? String(h.sqft) : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Price/sqft",
                    ...data.houses.map((h) =>
                      h.pricePerSqft != null
                        ? csvEscape(`$${h.pricePerSqft.toLocaleString()}`)
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Lot Size",
                    ...data.houses.map((h) =>
                      h.lotSize ? `"${h.lotSize}"` : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Stories",
                    ...data.houses.map((h) => h.stories ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Year Built",
                    ...data.houses.map((h) => h.yearBuilt ?? "—"),
                  ].join(",")
                );

                // ── Features ──
                pushSection("--- Features ---");
                csvRows.push(
                  [
                    "Garage",
                    ...data.houses.map((h) => h.garage ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Pool",
                    ...data.houses.map((h) => fmtBool(h.hasPool)),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Fireplace",
                    ...data.houses.map((h) => fmtBool(h.hasFireplace)),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Heating",
                    ...data.houses.map((h) =>
                      h.heating ? `"${h.heating}"` : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Cooling",
                    ...data.houses.map((h) =>
                      h.cooling ? `"${h.cooling}"` : "—"
                    ),
                  ].join(",")
                );

                // ── Costs ──
                pushSection("--- Costs ---");
                csvRows.push(
                  [
                    "HOA (Monthly)",
                    ...data.houses.map((h) => csvEscape(fmtCur(h.hoaMonthly))),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Tax Rate",
                    ...data.houses.map((h) =>
                      fmtPct(normalizeTaxRate(h.propertyTaxRate))
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Days on Zillow",
                    ...data.houses.map((h) => h.daysOnZillow ?? "—"),
                  ].join(",")
                );

                // ── Schools ──
                pushSection("--- Schools ---");
                csvRows.push(
                  [
                    "Nearby Schools",
                    ...data.houses.map((h) =>
                      `"${fmtSchools(h.schools)}"`
                    ),
                  ].join(",")
                );

                // ── Weighted Score ──
                csvRows.push(
                  [
                    "Weighted Score",
                    ...scores.map((s) => `${s.toFixed(1)} / 10`),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Score Breakdown",
                    ...scores.map((s, i) =>
                      s === bestScore
                        ? "🏆 Best"
                        : `${(
                            ((s - bestScore) / bestScore) *
                            100
                          ).toFixed(0)}% below best`
                    ),
                  ].join(",")
                );

                // ── First-Year Cost ──
                if (mortgages.some((m) => m.firstYearCost)) {
                  csvRows.push(
                    [
                      "Est. First-Year Cost",
                      ...mortgages.map((m) =>
                        m.firstYearCost?.totalFirstYear
                          ? csvEscape(`$${m.firstYearCost.totalFirstYear.toLocaleString()}`)
                          : "—"
                      ),
                    ].join(",")
                  );
                }

                // ── Major Systems ──
                pushSection("--- Major Systems ---");
                csvRows.push(
                  [
                    "Big-Ticket Risk",
                    ...data.houses.map((h) => h.systemAges?.bigTicketRisk ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Est. 5yr Big Repairs",
                    ...data.houses.map((h) =>
                      h.systemAges?.totalEstimatedBigRepairs
                        ? csvEscape(`$${h.systemAges.totalEstimatedBigRepairs.toLocaleString()}`)
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Roof Condition",
                    ...data.houses.map((h) => h.systemAges?.roofCondition ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Roof Repl. Cost",
                    ...data.houses.map((h) =>
                      h.systemAges?.roofReplacementEstimate
                        ? csvEscape(`$${h.systemAges.roofReplacementEstimate.toLocaleString()}`)
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Roof Remaining Life",
                    ...data.houses.map((h) => {
                      const r = h.systemAges?.roofRemainingLife;
                      if (r == null) return "—";
                      return r < 0 ? `${Math.abs(r)}yr past` : `${r}yr`;
                    }),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "HVAC Condition",
                    ...data.houses.map((h) => h.systemAges?.hvacCondition ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "HVAC Repl. Cost",
                    ...data.houses.map((h) =>
                      h.systemAges?.hvacReplacementEstimate
                        ? csvEscape(`$${h.systemAges.hvacReplacementEstimate.toLocaleString()}`)
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "HVAC Remaining Life",
                    ...data.houses.map((h) => {
                      const r = h.systemAges?.hvacRemainingLife;
                      if (r == null) return "—";
                      return r < 0 ? `${Math.abs(r)}yr past` : `${r}yr`;
                    }),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "Water Heater Condition",
                    ...data.houses.map((h) => h.systemAges?.waterHeaterCondition ?? "—"),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "WH Repl. Cost",
                    ...data.houses.map((h) =>
                      h.systemAges?.waterHeaterReplacementEstimate
                        ? csvEscape(`$${h.systemAges.waterHeaterReplacementEstimate.toLocaleString()}`)
                        : "—"
                    ),
                  ].join(",")
                );
                csvRows.push(
                  [
                    "WH Remaining Life",
                    ...data.houses.map((h) => {
                      const r = h.systemAges?.waterHeaterRemainingLife;
                      if (r == null) return "—";
                      return r < 0 ? `${Math.abs(r)}yr past` : `${r}yr`;
                    }),
                  ].join(",")
                );

                // ── Dealbreakers ──
                if (
                  noGoViolations &&
                  Object.keys(noGoViolations).length > 0
                ) {
                  csvRows.push(
                    [
                      "Dealbreakers (🚫)",
                      ...data.houses.map((h) => {
                        const v = noGoViolations[h.address];
                        return v && v.length > 0
                          ? `"${v.join("; ")}"`
                          : "—";
                      }),
                    ].join(",")
                  );
                }

                const csv = csvRows.join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "zillow-comparison.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          </div>
          <CompareTable
            houses={data.houses}
            weights={weights}
            userProfile={userProfile}
            noGoViolations={noGoViolations}
          />
        </Card>

        {/* Big-Ticket System Estimates */}
        <div className="mb-6">
          <BigTicketPanel houses={data.houses} />
        </div>

        {/* AI Summary */}
        <AiSummary result={data.aiResult} />
      </div>
    </main>
  );
}