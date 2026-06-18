"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { House, SystemAgeEstimate } from "@/lib/types";
import {
  Wrench,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
} from "lucide-react";

interface Props {
  houses: House[];
}

function riskBadge(risk: string | undefined | null) {
  if (!risk) return null;
  switch (risk) {
    case "low":
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Low Risk
        </Badge>
      );
    case "moderate":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 gap-1">
          <Clock className="h-3 w-3" />
          Moderate
        </Badge>
      );
    case "high":
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 gap-1">
          <AlertTriangle className="h-3 w-3" />
          High Risk
        </Badge>
      );
    case "critical":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <ArrowUpRight className="h-3 w-3" />
          Critical
        </Badge>
      );
    default:
      return null;
  }
}

function conditionBadge(condition: string | null | undefined) {
  if (!condition) return <span className="text-xs text-muted-foreground">—</span>;
  switch (condition) {
    case "good":
      return (
        <Badge
          variant="outline"
          className="border-green-300 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 text-[10px]"
        >
          🟢 Good
        </Badge>
      );
    case "fair":
      return (
        <Badge
          variant="outline"
          className="border-yellow-300 text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 text-[10px]"
        >
          🟡 Fair
        </Badge>
      );
    case "near-end":
      return (
        <Badge
          variant="outline"
          className="border-orange-300 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20 text-[10px]"
        >
          🟠 Near End
        </Badge>
      );
    case "past-end":
      return (
        <Badge
          variant="outline"
          className="border-red-300 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/20 text-[10px]"
        >
          🔴 Past End
        </Badge>
      );
    default:
      return <span className="text-xs text-muted-foreground">{condition}</span>;
  }
}

function remainingLifeText(years: number | null): string {
  if (years == null) return "Unknown";
  if (years < 0) return `${Math.abs(years)}yr past lifespan`;
  if (years === 0) return "End of life";
  return `${years}yr remaining`;
}

function SystemRow({
  label,
  age,
  remaining,
  cost,
  condition,
}: {
  label: string;
  age: number | null;
  remaining: number | null;
  cost: number | null;
  condition: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-2 text-xs">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground">
          {age != null ? `~${age}yr old` : "Age unknown"}
          {" · "}
          {remainingLifeText(remaining)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {cost != null && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ~${cost.toLocaleString()}
          </span>
        )}
        {conditionBadge(condition)}
      </div>
    </div>
  );
}

function HouseCard({ house }: { house: House }) {
  const sa = house.systemAges;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{house.address}</p>
          <p className="text-[10px] text-muted-foreground">
            Built {house.yearBuilt ?? "?"}
            {house.sqft != null ? ` · ${house.sqft.toLocaleString()} sqft` : ""}
          </p>
        </div>
        {riskBadge(sa?.bigTicketRisk)}
      </div>

      <Separator />

      {/* System breakdown */}
      <div className="space-y-0.5">
        <SystemRow
          label="🏠 Roof"
          age={sa?.roofAge ?? null}
          remaining={sa?.roofRemainingLife ?? null}
          cost={sa?.roofReplacementEstimate ?? null}
          condition={sa?.roofCondition ?? null}
        />
        <SystemRow
          label="🌬️ HVAC"
          age={sa?.hvacAge ?? null}
          remaining={sa?.hvacRemainingLife ?? null}
          cost={sa?.hvacReplacementEstimate ?? null}
          condition={sa?.hvacCondition ?? null}
        />
        <SystemRow
          label="💧 Water Heater"
          age={sa?.waterHeaterAge ?? null}
          remaining={sa?.waterHeaterRemainingLife ?? null}
          cost={sa?.waterHeaterReplacementEstimate ?? null}
          condition={sa?.waterHeaterCondition ?? null}
        />
      </div>

      {/* Total upcoming */}
      {sa && sa.totalEstimatedBigRepairs > 0 && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Est. big repairs (5yr)
            </p>
            <span className="text-xs font-semibold tabular-nums text-yellow-700 dark:text-yellow-400">
              ~${sa.totalEstimatedBigRepairs.toLocaleString()}
            </span>
          </div>
        </>
      )}

      {!sa && (
        <p className="text-xs text-muted-foreground italic">
          Insufficient data for system age estimates.
        </p>
      )}
    </div>
  );
}

export default function BigTicketPanel({ houses }: Props) {
  const hasEstimates = houses.some((h) => h.systemAges != null);

  if (!hasEstimates) return null;

  return (
    <Card className="border-yellow-200 dark:border-yellow-800">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <CardTitle className="text-base">Big-Ticket System Estimates</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          Conservative estimates based on year built — assumes original systems unless listing says otherwise.
          Actual condition may be better.
        </p>
      </CardHeader>
      <CardContent>
        <div
          className={`grid gap-4 ${
            houses.length === 1
              ? "grid-cols-1"
              : houses.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {houses.map((house, i) => (
            <HouseCard key={i} house={house} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}