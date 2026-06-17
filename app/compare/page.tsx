"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CompareTable from "@/components/CompareTable";
import AiSummary from "@/components/AiSummary";
import { House, Weights, CompareResponse, UserProfile } from "@/lib/types";
import { calculateMortgage } from "@/lib/mortgage";
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            Property Comparison
          </h1>
          <Button
            variant="link"
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
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">Comparison Results</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const headers = [
                  "Address",
                  "Home Type",
                  "Status",
                  "Price",
                  "Est. Monthly Payment",
                  "Est. Annual Tax",
                  "Est. Annual Insurance",
                  "Interest Rate",
                  "DTI Ratio",
                  "Down Payment",
                  "Cash Needed",
                  "Beds",
                  "Baths",
                  "Sqft",
                  "Price/Sqft",
                  "Lot Size",
                  "Stories",
                  "Year Built",
                  "Garage",
                  "Pool",
                  "Fireplace",
                  "Heating",
                  "Cooling",
                  "HOA (Monthly)",
                  "Tax Rate",
                  "Days on Zillow",
                  "Nearby Schools",
                  "AI Score",
                  "AI Pros",
                  "AI Cons",
                  "AI Affordability",
                  "AI Red Flags",
                  "AI First-Year Cost",
                ];
                const rows = data.houses.map((h, i) => {
                  const m = mortgages[i];
                  const aiHouse = data.aiResult?.perHouse?.find(
                    (p) => p.address === h.address
                  );
                  return [
                    `"${h.address}"`,
                    h.homeType ?? "",
                    h.status ?? "",
                    h.price ?? "",
                    m?.monthlyPayment ?? "",
                    m?.annualTax ?? "",
                    m?.annualInsurance ?? "",
                    m ? `${m.interestRate.toFixed(2)}%` : "",
                    m?.dtiRatio != null ? `${(m.dtiRatio * 100).toFixed(1)}%` : "",
                    m?.cashNeeded.downPayment ?? "",
                    m?.cashNeeded.total ?? "",
                    h.beds ?? "",
                    h.baths ?? "",
                    h.sqft ?? "",
                    h.pricePerSqft ?? "",
                    `"${h.lotSize ?? ""}"`,
                    h.stories ?? "",
                    h.yearBuilt ?? "",
                    h.garage ?? "",
                    h.hasPool != null ? (h.hasPool ? "Yes" : "No") : "",
                    h.hasFireplace != null ? (h.hasFireplace ? "Yes" : "No") : "",
                    `"${h.heating ?? ""}"`,
                    `"${h.cooling ?? ""}"`,
                    h.hoaMonthly ?? "",
                    h.propertyTaxRate ?? "",
                    h.daysOnZillow ?? "",
                    `"${h.schools.map((s) => `${s.name} (${s.rating ?? "NR"})`).join("; ")}"`,
                    aiHouse?.score?.toFixed(1) ?? "",
                    `"${(aiHouse?.pros ?? []).join("; ")}"`,
                    `"${(aiHouse?.cons ?? []).join("; ")}"`,
                    `"${aiHouse?.affordabilityRating ?? ""}"`,
                    `"${(aiHouse?.redFlags ?? []).join("; ")}"`,
                    aiHouse?.firstYearCostEstimate ?? "",
                  ];
                });
                const csv = [
                  headers.join(","),
                  ...rows.map((r) => r.join(",")),
                ].join("\n");
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

        {/* AI Summary */}
        <AiSummary result={data.aiResult} />
      </div>
    </main>
  );
}