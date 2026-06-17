"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useRouter } from "next/navigation";
import { Weights, UserProfile, NoGoFilters, DEFAULT_NO_GO } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const DEFAULT_WEIGHTS: Weights = {
  price: 5,
  schools: 4,
  size: 3,
  taxes: 3,
};

const CRITERIA = [
  { key: "price", label: "💰 Price", desc: "Lower is better", default: 5 },
  { key: "schools", label: "🏫 Schools", desc: "School quality", default: 4 },
  { key: "size", label: "📐 Size", desc: "Square footage", default: 3 },
  { key: "taxes", label: "🏛️ Taxes", desc: "Property tax rate", default: 3 },
] as const;

const STEPS = ["Priorities", "Financial Profile", "Property Addresses"];

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [addresses, setAddresses] = useState<string[]>(["", "", ""]);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    income: 0,
    creditScore: 700,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noGoFilters, setNoGoFilters] = useState<NoGoFilters>(DEFAULT_NO_GO);
  const [dealbreakersOpen, setDealbreakersOpen] = useState(false);

  const handleCompare = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses: addresses.filter((a) => a.trim()),
          weights,
          userProfile: userProfile.income > 0 ? userProfile : null,
          noGoFilters,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to compare properties");
      }

      sessionStorage.setItem("compareResult", JSON.stringify(data));
      sessionStorage.setItem("compareWeights", JSON.stringify(weights));
      sessionStorage.setItem("compareNoGoFilters", JSON.stringify(noGoFilters));
      if (userProfile.income > 0) {
        sessionStorage.setItem("compareUserProfile", JSON.stringify(userProfile));
      }
      router.push("/compare");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return true; // weights always have defaults
      case 1:
        return true; // financial profile is optional
      case 2:
        return addresses.some((a) => a.trim());
      default:
        return false;
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            🏠 House Compare Made Easy
          </h1>
          <p className="text-muted-foreground">
            Compare up to 3 properties side-by-side with AI-powered insights
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-sm ${
                  i === step ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Slide 1: Priorities & Dealbreakers */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Set Your Priorities</CardTitle>
              <CardDescription>
                Drag each slider to weight what matters most (1 = least, 5 = most important)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {CRITERIA.map(({ key, label, desc, default: def }) => (
                <div key={key} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">{label}</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {weights[key] ?? def}/5
                    </Badge>
                  </div>
                  <Slider
                    value={[weights[key] ?? def]}
                    onValueChange={([val]) =>
                      setWeights((prev) => ({ ...prev, [key]: val }))
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="py-1"
                  />
                </div>
              ))}

              <Separator />

              {/* No-Go Dealbreakers */}
              <Collapsible open={dealbreakersOpen} onOpenChange={setDealbreakersOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:text-foreground/80 transition-colors">
                  <span className="text-base font-semibold">🚫 Absolute Dealbreakers</span>
                  <span className="text-xs text-muted-foreground">
                    ({dealbreakersOpen ? "−" : "+"} optional filters)
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 mt-4">
                  <p className="text-xs text-muted-foreground">
                    Properties that violate any of these will be flagged as eliminated
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* No HOA */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noGoFilters.noHoa}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({ ...prev, noHoa: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">No HOA</span>
                    </label>

                    {/* No off-street parking */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noGoFilters.noOffStreetParking}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            noOffStreetParking: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Must have off-street parking</span>
                    </label>

                    {/* Single story only */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noGoFilters.singleStoryOnly}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            singleStoryOnly: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">Single-story only</span>
                    </label>

                    {/* No major issues */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noGoFilters.noMajorIssues}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            noMajorIssues: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                      />
                      <span className="text-sm">No major issues (foundation, water damage, mold)</span>
                    </label>
                  </div>

                  {/* Numeric thresholds */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="min-beds" className="text-xs">Min Bedrooms</Label>
                      <Input
                        id="min-beds"
                        type="number"
                        min={0}
                        max={10}
                        placeholder="Any"
                        value={noGoFilters.minBeds ?? ""}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            minBeds: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="min-baths" className="text-xs">Min Bathrooms</Label>
                      <Input
                        id="min-baths"
                        type="number"
                        min={0}
                        max={10}
                        placeholder="Any"
                        value={noGoFilters.minBaths ?? ""}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            minBaths: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="max-hoa" className="text-xs">Max HOA/mo ($)</Label>
                      <Input
                        id="max-hoa"
                        type="number"
                        min={0}
                        step={50}
                        placeholder="Any"
                        value={noGoFilters.maxHoaMonthly ?? ""}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            maxHoaMonthly: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="min-sqft" className="text-xs">Min Square Footage</Label>
                      <Input
                        id="min-sqft"
                        type="number"
                        min={0}
                        step={100}
                        placeholder="Any"
                        value={noGoFilters.minSqft ?? ""}
                        onChange={(e) =>
                          setNoGoFilters((prev) => ({
                            ...prev,
                            minSqft: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="h-9"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex justify-end pt-4">
                <Button onClick={() => setStep(1)} size="lg">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Slide 2: Financial Profile */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Your Financial Profile</CardTitle>
              <CardDescription>
                Optional — helps the AI assess affordability, commute, and total cost of ownership.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="income">Annual Income ($)</Label>
                  <Input
                    id="income"
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="e.g. 85000"
                    value={userProfile.income || ""}
                    onChange={(e) =>
                      setUserProfile((prev) => ({
                        ...prev,
                        income: e.target.value ? Number(e.target.value) : 0,
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="credit-score">Credit Score (300–850)</Label>
                  <Input
                    id="credit-score"
                    type="number"
                    placeholder="e.g. 720"
                    value={userProfile.creditScore || ""}
                    onChange={(e) =>
                      setUserProfile((prev) => ({
                        ...prev,
                        creditScore: e.target.value ? Number(e.target.value) : 300,
                      }))
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* Work Address for Commute */}
              <div className="grid gap-2">
                <Label htmlFor="work-address">Work Address (for commute consideration)</Label>
                <Input
                  id="work-address"
                  type="text"
                  placeholder="e.g. 456 Office Blvd, Austin, TX"
                  value={userProfile.workAddress || ""}
                  onChange={(e) =>
                    setUserProfile((prev) => ({
                      ...prev,
                      workAddress: e.target.value || undefined,
                    }))
                  }
                />
              </div>

              <Separator />

              {/* Renovation Budget */}
              <div>
                <h3 className="text-sm font-semibold mb-3">🔧 True Cost Estimate (Optional)</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Estimate your first-year total cost including repairs and renovations
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="immediate-repairs" className="text-xs">Immediate Repairs ($)</Label>
                    <Input
                      id="immediate-repairs"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 5000 (roof, HVAC)"
                      value={userProfile.renovationBudget?.immediateRepairs || ""}
                      onChange={(e) =>
                        setUserProfile((prev) => ({
                          ...prev,
                          renovationBudget: {
                            immediateRepairs: e.target.value ? Number(e.target.value) : 0,
                            desiredRenovations: prev.renovationBudget?.desiredRenovations ?? 0,
                            annualMaintenancePercent: prev.renovationBudget?.annualMaintenancePercent ?? 0.01,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="desired-renovations" className="text-xs">Desired Renovations ($)</Label>
                    <Input
                      id="desired-renovations"
                      type="number"
                      min={0}
                      step={500}
                      placeholder="e.g. 15000 (kitchen, floors)"
                      value={userProfile.renovationBudget?.desiredRenovations || ""}
                      onChange={(e) =>
                        setUserProfile((prev) => ({
                          ...prev,
                          renovationBudget: {
                            immediateRepairs: prev.renovationBudget?.immediateRepairs ?? 0,
                            desiredRenovations: e.target.value ? Number(e.target.value) : 0,
                            annualMaintenancePercent: prev.renovationBudget?.annualMaintenancePercent ?? 0.01,
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <Label className="text-xs">
                    Annual Maintenance Rate: ~{((userProfile.renovationBudget?.annualMaintenancePercent ?? 0.01) * 100).toFixed(1)}% of home value
                  </Label>
                  <Slider
                    value={[(userProfile.renovationBudget?.annualMaintenancePercent ?? 0.01) * 100]}
                    onValueChange={([val]) =>
                      setUserProfile((prev) => ({
                        ...prev,
                        renovationBudget: {
                          immediateRepairs: prev.renovationBudget?.immediateRepairs ?? 0,
                          desiredRenovations: prev.renovationBudget?.desiredRenovations ?? 0,
                          annualMaintenancePercent: val / 100,
                        },
                      }))
                    }
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="py-1"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(0)}>
                  ← Back
                </Button>
                <Button onClick={() => setStep(2)}>Next →</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Slide 3: Property Addresses */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Enter Property Addresses</CardTitle>
              <CardDescription>
                Enter up to 3 US property addresses to compare
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {addresses.map((addr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Address ${i + 1} (e.g. 123 Main St, Austin, TX)`}
                    value={addr}
                    onChange={(e) => {
                      const updated = [...addresses];
                      updated[i] = e.target.value;
                      setAddresses(updated);
                    }}
                    disabled={loading}
                  />
                  {addresses.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setAddresses((prev) => prev.filter((_, j) => j !== i));
                      }}
                      disabled={loading}
                      aria-label={`Remove address ${i + 1}`}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  {addresses.length < 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddresses((prev) => [...prev, ""])}
                      disabled={loading}
                    >
                      + Add Address
                    </Button>
                  )}
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={loading || !addresses.some((a) => a.trim())}
                >
                  {loading ? "Comparing..." : "Compare Properties"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Data sourced from publicly available real estate listings. For informational purposes only — not affiliated with any listing provider. Verify all details with a licensed agent before making decisions.
        </p>
      </div>
    </main>
  );
}