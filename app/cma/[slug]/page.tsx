"use client";

import { useState, useEffect } from "react";
import { useParams, notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
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

export default function CmaReportPermalinkPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [report, setReport] = useState<CmaReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

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

  if (!slug) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Invalid report URL.</p>
      </main>
    );
  }

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
            CMA Report
          </h1>
          {report ? (
            <p className="text-base sm:text-lg font-medium text-foreground mb-1">
              {report.reportData.subjectProperty.address}
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm sm:text-base">
            Comparative Market Analysis
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <Card className="mb-8">
            <CardContent className="py-12 space-y-4">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Report content */}
        {report && !loading && (
          <>
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

            <div className="mt-8 flex justify-center items-center gap-3">
              <Link href="/cma">
                <Button variant="outline" size="lg">
                  ← Generate New Report
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
