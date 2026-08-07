"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CMAReportData } from "@/lib/cma";

const CmaReport = dynamic(() => import("@/components/CmaReport"), { ssr: false });
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

export default function CmaReportPermalinkPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [report, setReport] = useState<CmaReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);
        const res = await fetch(`/api/cma/report/${encodeURIComponent(slug)}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
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

  // Decode slug for display when report isn't loaded yet
  const slugDisplay = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-2">
              <Link href="/">
                <Image src="/domuzz_logo.svg" alt="Domuzz" width={180} height={41} priority
                  className="h-auto w-auto sm:w-[200px]" />
              </Link>
            </div>
            <p className="text-lg sm:text-xl font-semibold mt-4 mb-1">{slugDisplay}</p>
            <h1 className="text-xl sm:text-2xl font-bold mb-2">CMA Report</h1>
          </div>
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

  if (notFound) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="flex justify-center mb-4">
            <Link href="/">
              <Image src="/domuzz_logo.svg" alt="Domuzz" width={180} height={41} priority
                className="h-auto w-auto sm:w-[200px]" />
            </Link>
          </div>
          <h1 className="text-2xl font-bold mb-4">Report Not Found</h1>
          <p className="text-muted-foreground mb-2">
            No CMA report exists for this address yet.
          </p>
          <p className="text-muted-foreground mb-6">
            {slugDisplay}
          </p>
          <Link href="/cma">
            <Button size="lg">Generate a Free CMA Report</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error || "Report data unavailable."}</p>
            </CardContent>
          </Card>
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
              <Image src="/domuzz_logo.svg" alt="Domuzz" width={180} height={41} priority
                className="h-auto w-auto sm:w-[200px]" />
            </Link>
          </div>
          <p className="text-lg sm:text-xl font-semibold text-foreground mt-4 mb-1">
            {displayAddress}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold mb-1">CMA Report</h1>
          {reportDate && (
            <p className="text-sm text-muted-foreground mb-1">Generated on {reportDate}</p>
          )}
          <div className="mt-4 flex justify-center items-center gap-3 flex-wrap">
            <Link href="/cma">
              <Button variant="secondary" size="lg" className="rounded-full shadow-sm px-5">
                ← Generate New Report
              </Button>
            </Link>
            <Link href={regenerateUrl}>
              <Button size="lg" className="rounded-full shadow-sm px-5" disabled={!canRegenerate}
                title={canRegenerate ? "Regenerate with fresh data" : "Available 3 months after generation"}>
                🔄 Regenerate CMA Report
              </Button>
            </Link>
            <a href="https://buymeacoffee.com/domuzzcom" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="rounded-full shadow-sm px-5 bg-[#FFDD00] text-[#000000] hover:bg-[#FFDD00]/90 border-[#FFDD00]">
                ☕ Buy me a coffee
              </Button>
            </a>
          </div>
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
