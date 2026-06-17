"use client";

import { Weights, PriorityTier, TieredPriorities } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const CRITERIA = [
  { key: "price", label: "Listing Price", default: 5, icon: "💰" },
  { key: "monthlyPayment", label: "Est. Monthly Cost", default: 5, icon: "💳" },
  { key: "annualTax", label: "Annual Property Tax", default: 4, icon: "🏛️" },
  { key: "dtiRatio", label: "DTI Ratio (lower better)", default: 4, icon: "📉" },
  { key: "downPayment", label: "Down Payment Needed", default: 4, icon: "🏦" },
  { key: "schools", label: "School Quality", default: 4, icon: "🎓" },
  { key: "size", label: "Size (sqft)", default: 3, icon: "📐" },
  { key: "taxes", label: "Tax Rate %", default: 3, icon: "📋" },
  { key: "yearBuilt", label: "Year Built", default: 3, icon: "🏗️" },
  { key: "lotSize", label: "Lot Size", default: 3, icon: "🌳" },
  { key: "hoa", label: "HOA Fees", default: 3, icon: "📎" },
  { key: "pricePerSqft", label: "Price per Sqft", default: 3, icon: "📊" },
  { key: "daysOnZillow", label: "Days Listed", default: 2, icon: "📅" },
  { key: "beds", label: "Bedrooms", default: 3, icon: "🛏️" },
  { key: "baths", label: "Bathrooms", default: 3, icon: "🛁" },
  { key: "garage", label: "Garage Spaces", default: 3, icon: "🚗" },
  { key: "stories", label: "Stories", default: 2, icon: "🏢" },
] as const;

function tierBadge(tier: PriorityTier) {
  switch (tier) {
    case "must":
      return { label: "Must Have", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" };
    case "nice":
      return { label: "Nice to Have", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" };
    case "bonus":
      return { label: "Bonus", className: "bg-muted text-muted-foreground" };
  }
}

interface Props {
  weights: Weights;
  onChange: (weights: Weights) => void;
  tieredPriorities?: TieredPriorities;
  onTieredChange?: (tiered: TieredPriorities) => void;
}

export default function WeightPanel({ weights, onChange, tieredPriorities, onTieredChange }: Props) {
  const handleChange = (key: string, value: number) => {
    onChange({ ...weights, [key]: value });
  };

  const handleTierChange = (key: string, tier: PriorityTier) => {
    if (!onTieredChange) return;
    const current = tieredPriorities?.[key];
    onTieredChange({
      ...tieredPriorities,
      [key]: { tier, threshold: current?.threshold },
    });
  };

  const getTier = (key: string): PriorityTier => {
    return tieredPriorities?.[key]?.tier ?? "nice";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Your Priorities</CardTitle>
        <CardDescription>
          Rate each factor 1–5 and classify as Must-Have, Nice-to-Have, or Bonus tiebreaker
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0 max-h-[550px] overflow-y-auto pr-2">
        {onTieredChange && (
          <div className="flex gap-2 mb-3 pb-3 border-b">
            <Badge variant="secondary" className={tierBadge("must").className}>Must Have</Badge>
            <Badge variant="secondary" className={tierBadge("nice").className}>Nice</Badge>
            <Badge variant="secondary" className={tierBadge("bonus").className}>Bonus</Badge>
          </div>
        )}
        {CRITERIA.map(({ key, label, default: def, icon }) => {
          const tier = getTier(key);
          return (
            <div key={key} className="grid gap-1.5 py-2 border-b border-muted/50 last:border-b-0">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium leading-none flex items-center gap-1.5">
                  <span className="text-base">{icon}</span>
                  {label}
                </label>
                <div className="flex items-center gap-1.5">
                  {onTieredChange && (
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${tierBadge(tier).className}`}>
                      {tierBadge(tier).label}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">1–5</span>
                  <span className="text-sm font-mono tabular-nums font-bold min-w-[1.5rem] text-right">
                    {weights[key] ?? def}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={weights[key] ?? def}
                  onChange={(e) => handleChange(key, Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
                {onTieredChange && (
                  <div className="flex gap-1 shrink-0">
                    {(["must", "nice", "bonus"] as PriorityTier[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTierChange(key, t)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                          tier === t
                            ? t === "must"
                              ? "border-red-400 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                              : t === "nice"
                                ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                                : "border-muted-foreground/30 bg-muted text-muted-foreground"
                            : "border-transparent hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {t === "must" ? "M" : t === "nice" ? "N" : "B"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
