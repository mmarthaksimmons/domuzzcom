"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CMAReportData } from "@/lib/cma";
import CmaReport from "@/components/CmaReport";

const CmaMap = dynamic(() => import("@/components/CmaMap"), { ssr: false });
const CmaCharts = dynamic(() => import("@/components/CmaCharts"), { ssr: false });

interface CmaReportResponse {
  slug: string;
  address: string;
  reportData: CMAReportData;
  aiAnalysis: string | null;
  createdAt: string;
}

const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000;

function formatReportDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => {
    if (/^\d+$/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

export default function CmaReportPermalinkClient({ slug }: { slug: string }) {
  const [report, setReport] = useState<CmaReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/cma/report/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) notFound();
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load report");
        }
        const data: CmaReportResponse = await res.json();
        if (!cancelled) setReport(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "An error occurred");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReport();
    return () => { cancelled = true; };
  }, [slug]);

  const canRegenerate = useMemo(() => {
    if (!report?.createdAt) return false;
    const age = Date.now() - new Date(report.createdAt).getTime();
    return age >= THREE_MONTHS_MS;
  }, [report?.createdAt]);

  const reportDate = report?.createdAt ? formatReportDate(report.createdAt) : null;
  const displayAddress = toTitleCase(report?.address ?? "");
  const regenerateUrl = report?.address
    ? `/cma?address=${encodeURIComponent(report.address)}`
    : "/cma";

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <Card className="mb-8">
            <CardContent className="py-12 space-y-4">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <p className="text-center text-muted-foreground">Report data unavailable.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
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
          <p className="text-lg sm:text-xl font-semibold text-foreground mt-4 mb-1">
            {displayAddress}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">
            CMA Report
          </h1>
          {reportDate && (
            <p className="text-sm text-muted-foreground mb-1">
              Generated on {reportDate}
            </p>
          )}
          <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
            Get an instant Comparative Market Analysis for any US property.
            Powered by real market data — no agent required.
          </p>
        </div>

        <CmaReport reportData={report.reportData} />
        <CmaMap reportData={report.reportData} />
        <CmaCharts reportData={report.reportData} />

        {report.aiAnalysis && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">AI Market Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-line">
                {report.aiAnalysis}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 flex justify-center items-center gap-3 flex-wrap">
          <Link href="/cma">
            <Button variant="outline" size="lg">
              ← Generate New Report
            </Button>
          </Link>
          <Link href={regenerateUrl}>
            <Button
              size="lg"
              disabled={!canRegenerate}
              title={
                canRegenerate
                  ? "Regenerate this report with fresh data"
                  : "You can regenerate this report 3 months after it was generated"
              }
            >
              🔄 Regenerate CMA Report
            </Button>
          </Link>
          <a
            href="https://buymeacoffee.com/domuzzcom"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-[#FFDD00] text-[#000000] hover:bg-[#FFDD00]/90 h-10 px-8"
          >
            ☕ Buy me a coffee
          </a>
        </div>

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
