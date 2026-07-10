"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RENOVATION_OPTIONS, calculateAdjustedValue } from "@/lib/cma";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

interface RenovationAdjustmentsProps {
  baseEstimate: number;
  onChange?: (data: { renovations: Record<string, number>; adjustedValue: number; addedValue: number; totalSpent: number }) => void;
}

export default function RenovationAdjustments({
  baseEstimate,
  onChange,
}: RenovationAdjustmentsProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const handleCheck = (key: string, isChecked: boolean) => {
    setChecked((prev) => ({ ...prev, [key]: isChecked }));
    if (!isChecked) {
      setAmounts((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const handleAmount = (key: string, value: string) => {
    setAmounts((prev) => ({ ...prev, [key]: value }));
  };

  const renovations = useMemo(() => {
    const result: Record<string, number> = {};
    for (const opt of RENOVATION_OPTIONS) {
      if (checked[opt.key] && amounts[opt.key]) {
        result[opt.key] = parseFloat(amounts[opt.key]) || 0;
      }
    }
    return result;
  }, [checked, amounts]);

  const { addedValue, adjustedValue } = useMemo(
    () => calculateAdjustedValue(baseEstimate, renovations),
    [baseEstimate, renovations]
  );

  const totalSpent = useMemo(
    () => Object.values(renovations).reduce((sum, v) => sum + v, 0),
    [renovations]
  );

  useEffect(() => {
    onChange?.({ renovations, adjustedValue, addedValue, totalSpent });
  }, [renovations, adjustedValue, addedValue, totalSpent, onChange]);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">
          🏠 Renovation Value Adjustments
        </CardTitle>
        <CardDescription>
          Select renovations and enter estimated costs to see how they could
          impact your home's value. ROI percentages are approximate
          industry averages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {RENOVATION_OPTIONS.map((option) => (
            <div
              key={option.key}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 border-b last:border-0"
            >
              <label className="flex items-center gap-2 cursor-pointer min-w-[200px]">
                <input
                  type="checkbox"
                  checked={!!checked[option.key]}
                  onChange={(e) => handleCheck(option.key, e.target.checked)}
                  className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                />
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  (~{option.roiPercent}% ROI)
                </span>
              </label>
              {checked[option.key] && (
                <div className="flex items-center gap-2 flex-1">
                  <Label className="text-xs whitespace-nowrap">
                    Amount spent:
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="$5,000"
                    value={amounts[option.key] || ""}
                    onChange={(e) =>
                      handleAmount(option.key, e.target.value)
                    }
                    className="w-full sm:w-40 h-8 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Base AVM Estimate</p>
              <p className="text-lg font-bold">{formatPrice(baseEstimate)}</p>
            </div>
            <div className="text-center text-muted-foreground text-lg">+</div>
            <div>
              <p className="text-xs text-muted-foreground">
                Added Renovation Value
                {totalSpent > 0 && (
                  <span className="ml-1">
                    (spent {formatPrice(totalSpent)})
                  </span>
                )}
              </p>
              <p className="text-lg font-bold text-green-600">
                {formatPrice(addedValue)}
              </p>
            </div>
            <div className="text-center text-muted-foreground text-lg">=</div>
            <div>
              <p className="text-xs text-muted-foreground">Adjusted Estimate</p>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(adjustedValue)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}