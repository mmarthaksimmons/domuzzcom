"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, PiggyBank, DollarSign, Percent, Calculator, Home } from "lucide-react";
import {
  calculateFsboSavings,
  DEFAULT_FSBO_INPUTS,
  FsboInputs,
  FsboResult,
  formatCurrency,
} from "@/lib/fsbo";

export default function FsboPage() {
  const [inputs, setInputs] = useState<FsboInputs>(DEFAULT_FSBO_INPUTS);
  const result: FsboResult = calculateFsboSavings(inputs);

  const handlePriceChange = (value: string) => {
    const num = value ? parseInt(value.replace(/[^0-9]/g, "")) : 0;
    setInputs((prev) => ({ ...prev, homePrice: num }));
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex justify-center mb-2">
            <Link href="/">
              <Image
                src="/domuzz_logo.svg"
                alt="Domuzz"
                width={180}
                height={41}
                priority
                className="h-auto w-auto sm:w-[200px]"
              />
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-4 mb-2">
            FSBO Savings Calculator
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            See how much you can save by selling your home without a listing agent.
            Adjust the sliders to match your situation.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Inputs */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Your Home Sale Details
              </CardTitle>
              <CardDescription>
                Adjust the values below to calculate your potential FSBO savings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Home Price */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="home-price" className="text-sm font-medium">
                    <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                    Home Sale Price
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {formatCurrency(inputs.homePrice)}
                  </span>
                </div>
                <Input
                  id="home-price"
                  type="text"
                  inputMode="numeric"
                  value={inputs.homePrice.toLocaleString()}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  className="font-mono"
                />
                <Slider
                  value={[inputs.homePrice]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, homePrice: val }))
                  }
                  min={50_000}
                  max={5_000_000}
                  step={10_000}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>$50,000</span>
                  <span>$5,000,000</span>
                </div>
              </div>

              {/* Remaining Mortgage */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <Home className="h-3.5 w-3.5 inline mr-1" />
                    Est. Remaining Mortgage
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {formatCurrency(inputs.remainingMortgage)}
                  </span>
                </div>
                <Slider
                  value={[inputs.remainingMortgage]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, remainingMortgage: val }))
                  }
                  min={0}
                  max={inputs.homePrice}
                  step={5_000}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>$0</span>
                  <span>{formatCurrency(inputs.homePrice)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Your estimated mortgage balance to pay off at closing. This is deducted from your net proceeds.
                </p>
              </div>

              <Separator />

              {/* Listing Agent Commission */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <Percent className="h-3.5 w-3.5 inline mr-1" />
                    Listing Agent Commission
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {inputs.listingAgentCommission.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[inputs.listingAgentCommission]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, listingAgentCommission: Math.round(val * 10) / 10 }))
                  }
                  min={1}
                  max={4}
                  step={0.1}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>1.0%</span>
                  <span>4.0%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Typical listing agent commission is 2.5–3%. This is what you save by going FSBO.
                </p>
              </div>

              {/* Buyer's Agent Commission */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <Percent className="h-3.5 w-3.5 inline mr-1" />
                    Buyer's Agent Commission
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {inputs.buyersAgentCommission.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[inputs.buyersAgentCommission]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, buyersAgentCommission: Math.round(val * 10) / 10 }))
                  }
                  min={0.5}
                  max={4}
                  step={0.1}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>0.5%</span>
                  <span>4.0%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Offering a buyer's agent commission helps attract buyers. Typical: 2.5%.
                </p>
              </div>

              <Separator />

              {/* MLS Flat Fee */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <DollarSign className="h-3.5 w-3.5 inline mr-1" />
                    Flat-Fee MLS Listing
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {formatCurrency(inputs.flatFeeMls)}
                  </span>
                </div>
                <Slider
                  value={[inputs.flatFeeMls]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, flatFeeMls: val }))
                  }
                  min={0}
                  max={2_000}
                  step={50}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>$0</span>
                  <span>$2,000</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  FSBO sellers pay a flat fee (usually $200–$1,000) to list on the MLS for maximum exposure.
                </p>
              </div>

              {/* Additional Selling Costs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    <Percent className="h-3.5 w-3.5 inline mr-1" />
                    Additional Selling Costs
                  </Label>
                  <span className="text-sm font-mono font-semibold text-primary">
                    {inputs.additionalSellingCostsPercent}%
                  </span>
                </div>
                <Slider
                  value={[inputs.additionalSellingCostsPercent]}
                  onValueChange={([val]) =>
                    setInputs((prev) => ({ ...prev, additionalSellingCostsPercent: val }))
                  }
                  min={0}
                  max={3}
                  step={0.5}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>0%</span>
                  <span>3%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Closing costs the seller typically covers (title insurance, transfer taxes, attorney fees).
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Results */}
          <Card className="lg:col-span-2 h-fit lg:sticky lg:top-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-green-600" />
                Your Savings
              </CardTitle>
              <CardDescription>
                Based on a home sale price of {formatCurrency(inputs.homePrice)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Savings Highlight */}
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">You Could Save</p>
                <p className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400 font-mono">
                  {formatCurrency(result.savings)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  ({result.savingsPercent}% of sale price)
                </p>
              </div>

              <Separator />

              {/* Breakdown */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale Price</span>
                  <span className="font-mono font-medium">{formatCurrency(inputs.homePrice)}</span>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    With a Listing Agent
                  </p>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">Listing agent fee ({inputs.listingAgentCommission}%)</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(result.listingAgentCommissionSaved)}
                    </span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">Buyer's agent fee ({inputs.buyersAgentCommission}%)</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(Math.round(inputs.homePrice * (inputs.buyersAgentCommission / 100)))}
                    </span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">Additional costs ({inputs.additionalSellingCostsPercent}%)</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(Math.round(inputs.homePrice * (inputs.additionalSellingCostsPercent / 100)))}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Net Proceeds with Agent</span>
                    <span className="font-mono">{formatCurrency(result.netProceedsWithAgent)}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                    Selling FSBO
                  </p>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">Buyer's agent fee</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(Math.round(inputs.homePrice * (inputs.buyersAgentCommission / 100)))}
                    </span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">MLS flat fee</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(inputs.flatFeeMls)}
                    </span>
                  </div>
                  <div className="flex justify-between pl-2">
                    <span className="text-muted-foreground">Additional costs</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(Math.round(inputs.homePrice * (inputs.additionalSellingCostsPercent / 100)))}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Net Proceeds FSBO</span>
                    <span className="font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(result.netProceedsFsbo)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Cash In Pocket After Mortgage */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    After Mortgage Payoff
                  </p>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining mortgage</span>
                    <span className="font-mono text-destructive">
                      −{formatCurrency(inputs.remainingMortgage)}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Cash in pocket with agent</span>
                      <span className="font-mono font-medium">{formatCurrency(result.cashInPocketWithAgent)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-green-700 dark:text-green-400 font-medium">Cash in pocket FSBO</span>
                      <span className="font-mono font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(result.cashInPocketFsbo)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disclaimer */}
        <p className="mt-10 text-center text-[11px] sm:text-xs text-muted-foreground px-2 max-w-2xl mx-auto">
          This calculator provides estimates for informational purposes only. Actual
          savings depend on your specific situation, local market conditions, and
          negotiated commission rates. Consult a real estate attorney or financial
          advisor before making FSBO decisions.
        </p>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Button variant="ghost" asChild size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}