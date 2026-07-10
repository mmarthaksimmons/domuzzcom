"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CMAReportData } from "@/lib/cma";
import { Sparkles } from "lucide-react";

interface CmaAiAnalysisProps {
  reportData: CMAReportData;
  onAnalysisReady?: (text: string) => void;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

export default function CmaAiAnalysis({ reportData, onAnalysisReady }: CmaAiAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notify parent whenever analysis changes
  useEffect(() => {
    if (analysis) {
      onAnalysisReady?.(analysis);
    }
  }, [analysis, onAnalysisReady]);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/cma/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportData }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate analysis");
      }

      setAnalysis(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading && !error) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="py-6 text-center">
          <Button
            variant="outline"
            onClick={handleAnalyze}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Get AI Market Analysis
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Let AI analyze the comparables and provide market insights
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-4 bg-muted rounded w-5/6 mx-auto" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Analyzing market data...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6 border-destructive/30">
        <CardContent className="py-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            className="mt-2"
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const paragraphs = analysis ? splitParagraphs(analysis) : [];

  return (
    <Card className="mt-6 border-primary/20 bg-primary/5">
      <CardContent className="py-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Market Analysis</h3>
        </div>
        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed text-muted-foreground"
            >
              {p}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}