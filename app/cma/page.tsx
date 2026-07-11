"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CMAReportData } from "@/lib/cma";
import CmaReport from "@/components/CmaReport";
import CmaAiAnalysis from "@/components/CmaAiAnalysis";
import RenovationAdjustments from "@/components/RenovationAdjustments";
import EmailCaptureModal from "@/components/EmailCaptureModal";
import ProgressPanel, { type ProgressEvent } from "@/components/ProgressPanel";

const CmaMap = dynamic(() => import("@/components/CmaMap"), { ssr: false });
const CmaCharts = dynamic(() => import("@/components/CmaCharts"), { ssr: false });

interface RenovationState {
  renovations: Record<string, number>;
  adjustedValue: number;
  addedValue: number;
  totalSpent: number;
}

export default function CmaPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<CMAReportData | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [renovationData, setRenovationData] = useState<RenovationState | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError(null);
    setReportData(null);
    setAiAnalysis(null);
    setRenovationData(null);

    try {
      const res = await fetch(
        `/api/cma?address=${encodeURIComponent(address.trim())}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate CMA report");
      }

      setReportData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleAnalysisReady = useCallback((text: string) => {
    setAiAnalysis(text);
  }, []);

  const handleRenovationChange = useCallback((data: RenovationState) => {
    setRenovationData(data);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex justify-center mb-2">
            <Image
              src="/domuzz_logo.svg"
              alt="Domuzz"
              width={180}
              height={41}
              priority
              className="h-auto w-auto sm:w-[200px]"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-4 mb-2">
            Free CMA Report
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Get an instant Comparative Market Analysis for any US property.
            Powered by real market data — no agent required.
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Enter a Property Address</CardTitle>
            <CardDescription>
              See what comparable homes have sold for in your area
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="e.g. 123 Main St, Austin, TX 78701"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                className="flex-1"
                autoComplete="street-address"
              />
              <Button type="submit" disabled={loading || !address.trim()}>
                {loading ? "Generating..." : "Get CMA Report"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card className="mb-8">
            <CardContent className="py-8">
              <ProgressPanel
                stages={[
                  { key: "detail", label: "Looking up subject property", icon: "🏠" },
                  { key: "search", label: "Searching for area comparables", icon: "🔎" },
                  { key: "estimate", label: "Computing property estimate", icon: "📊" },
                ]}
              />
            </CardContent>
          </Card>
        )}

        {reportData && !loading && (
          <>
            <CmaReport reportData={reportData} />
            <CmaMap reportData={reportData} />
            <CmaCharts reportData={reportData} />
            <CmaAiAnalysis reportData={reportData} onAnalysisReady={handleAnalysisReady} />
            <RenovationAdjustments baseEstimate={reportData.estimate.price} onChange={handleRenovationChange} />

            <div className="mt-8 flex justify-center items-center gap-3">
              <a
                href="https://buymeacoffee.com/domuzzcom"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-[#FFDD00] text-[#000000] hover:bg-[#FFDD00]/90 h-10 px-8"
              >
                ☕ Buy me a coffee
              </a>
              <Button size="lg" onClick={() => setShowEmailModal(true)}>
                📥 Download PDF Report
              </Button>
            </div>

            <EmailCaptureModal
              open={showEmailModal}
              onClose={() => setShowEmailModal(false)}
              address={reportData.subjectProperty.address}
              reportData={reportData}
              aiAnalysis={aiAnalysis}
              renovationData={renovationData}
            />
          </>
        )}

        <p className="mt-12 text-center text-[11px] sm:text-xs text-muted-foreground px-2">
          This estimate is generated by an automated valuation model (AVM) using
          public and listing data. It is not a formal appraisal. Consult a
          licensed appraiser for financing decisions. Data sourced from public
          records and listing data.
        </p>
      </div>
    </main>
  );
}