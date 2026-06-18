"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  Star,
  ThumbsUp,
  Flame,
  CalendarClock,
} from "lucide-react";

interface PerHouse {
  address: string;
  pros: string[];
  cons: string[];
  score: number;
  monthlyEstimate?: number;
  affordabilityRating?: string;
  redFlags?: string[];
  firstYearCostEstimate?: number;
}

interface AiResult {
  summary: string;
  perHouse: PerHouse[];
  recommendation: string;
  financialSummary?: string;
}

interface Props {
  result: AiResult | null;
}

function affordabilityColor(rating?: string): string {
  if (!rating) return "bg-muted text-muted-foreground";
  const lower = rating.toLowerCase();
  if (lower.includes("excellent") || lower.includes("comfort")) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (lower.includes("good") || lower.includes("moderat")) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (lower.includes("tight") || lower.includes("stretch")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  if (lower.includes("poor") || lower.includes("unafford")) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

function scoreColor(score: number): string {
  if (score >= 8) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 6) return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  if (score >= 4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
}

export default function AiSummary({ result }: Props) {
  const [open, setOpen] = useState(false);

  if (!result) return null;

  const hasFinancial = result.perHouse.some(
    (h) => h.monthlyEstimate || h.affordabilityRating
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <CardTitle>AI-Powered Analysis</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                {open ? "Hide" : "Show"} Full Analysis
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Executive Summary */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5" />
                Executive Summary
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {typeof result.summary === "string" ? result.summary : JSON.stringify(result.summary)}
              </p>
            </div>

            {/* Per-house detailed cards */}
            <div className="grid gap-4">
              {result.perHouse.map((h, i) => (
                <div key={i} className="border rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5">
                      <span className="text-muted-foreground">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {h.address}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge className={scoreColor(h.score)} variant="secondary">
                        <Star className="h-3 w-3 mr-1" />
                        Score: {h.score.toFixed(1)}
                      </Badge>
                    </div>
                  </div>

                  {/* Financial estimate row */}
                  {hasFinancial && (
                    <div className="flex flex-wrap gap-2">
                      {h.monthlyEstimate != null && (
                        <Badge variant="outline" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          ~${h.monthlyEstimate.toLocaleString()}/mo
                        </Badge>
                      )}
                      {h.firstYearCostEstimate != null && (
                        <Badge variant="outline" className="gap-1 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-400">
                          <CalendarClock className="h-3 w-3" />
                          ~${h.firstYearCostEstimate.toLocaleString()} first year
                        </Badge>
                      )}
                      {h.affordabilityRating && (
                        <Badge className={affordabilityColor(h.affordabilityRating)} variant="secondary">
                          {h.affordabilityRating.toLowerCase().includes("excellent") ||
                          h.affordabilityRating.toLowerCase().includes("comfort") ? (
                            <ShieldCheck className="h-3 w-3 mr-1" />
                          ) : h.affordabilityRating.toLowerCase().includes("poor") ||
                            h.affordabilityRating.toLowerCase().includes("tight") ||
                            h.affordabilityRating.toLowerCase().includes("stretch") ? (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          ) : (
                            <TrendingUp className="h-3 w-3 mr-1" />
                          )}
                          {h.affordabilityRating}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Red Flags */}
                  {h.redFlags && h.redFlags.length > 0 && (
                    <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        Red Flags
                      </p>
                      <ul className="list-disc list-inside text-[11px] text-red-600 dark:text-red-400 space-y-0.5">
                        {h.redFlags.map((flag, j) => (
                          <li key={j}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pros */}
                  <div>
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1.5 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Pros
                    </p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                      {(Array.isArray(h.pros) ? h.pros : [h.pros]).map((p, j) => (
                        <li key={j}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Cons */}
                  <div>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" />
                      Cons
                    </p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                      {(Array.isArray(h.cons) ? h.cons : [h.cons]).map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            {result.financialSummary && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-blue-800 dark:text-blue-300">
                  <DollarSign className="h-3.5 w-3.5" />
                  Financial Health Assessment
                </h4>
                <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-300">
                  {typeof result.financialSummary === "string"
                    ? result.financialSummary
                    : JSON.stringify(result.financialSummary)}
                </p>
              </div>
            )}

            <Separator />

            {/* Final Recommendation */}
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-primary">
                <ThumbsUp className="h-3.5 w-3.5" />
                Our Recommendation
              </h4>
              <p className="text-sm leading-relaxed">
                {typeof result.recommendation === "string"
                  ? result.recommendation
                  : JSON.stringify(result.recommendation)}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}