"use client";

import { useMemo } from "react";
import { CMAReportData, Comparable } from "@/lib/cma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

function correlationPercent(c: number): string {
  return `${Math.round(c * 100)}%`;
}

function statusBadge(comparable: Comparable) {
  if (comparable.isSold) {
    return (
      <Badge variant="outline" className="border-red-400 text-red-600 gap-1 pl-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
        Sold
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-400 text-green-600 gap-1 pl-1.5">
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      Active
    </Badge>
  );
}

/** Reusable comparable table section */
function ComparableSection({
  title,
  comparables,
  formatPrice,
  formatNumber,
  correlationPercent,
  statusBadge,
}: {
  title: string;
  comparables: Comparable[];
  formatPrice: (p: number) => string;
  formatNumber: (n: number | null) => string;
  correlationPercent: (c: number) => string;
  statusBadge: (c: Comparable) => React.ReactNode;
}) {
  if (comparables.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Address</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Price</TableHead>
              <TableHead className="text-xs">Beds</TableHead>
              <TableHead className="text-xs">Baths</TableHead>
              <TableHead className="text-xs">Sq Ft</TableHead>
              <TableHead className="text-xs">Distance</TableHead>
              <TableHead className="text-xs">DOM</TableHead>
              <TableHead className="text-xs">Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparables.map((comp, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium max-w-[180px] truncate">
                  {comp.address}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {comp.propertyType ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {statusBadge(comp)}
                </TableCell>
                <TableCell className="text-xs">
                  {formatPrice(comp.price)}
                </TableCell>
                <TableCell className="text-xs">
                  {comp.beds}
                </TableCell>
                <TableCell className="text-xs">
                  {comp.baths}
                </TableCell>
                <TableCell className="text-xs">
                  {formatNumber(comp.sqft)}
                </TableCell>
                <TableCell className="text-xs">
                  {comp.distance !== null
                    ? `${comp.distance.toFixed(1)} mi`
                    : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {comp.daysOnMarket !== null ? comp.daysOnMarket : "—"}
                </TableCell>
                <TableCell className="text-xs">
                  <Badge
                    variant={
                      comp.correlation >= 0.98 ? "default" : "secondary"
                    }
                  >
                    {correlationPercent(comp.correlation)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function CmaReport({
  reportData,
}: {
  reportData: CMAReportData;
}) {
  const { subjectProperty, estimate, soldComparables, activeComparables } =
    reportData;
    const midpoint = estimate.price;
    const allComparables = [...soldComparables, ...activeComparables];

    // Compute market stats from all comps
    const marketStats = useMemo(() => {
      const compsWithPrice = allComparables.filter((c) => c.price > 0);
      const compsWithDom = allComparables.filter((c) => c.daysOnMarket != null);
      const compsWithSqft = allComparables.filter((c) => c.price > 0 && c.sqft > 0);

      if (compsWithPrice.length === 0) return null;

      const prices = compsWithPrice.map((c) => c.price).sort((a, b) => a - b);
      const n = prices.length;
      const avgPrice = prices.reduce((s, p) => s + p, 0) / n;
      const medPrice = n % 2 === 0
        ? (prices[n / 2 - 1] + prices[n / 2]) / 2
        : prices[Math.floor(n / 2)];

      const avgPpsf = compsWithSqft.length > 0
        ? compsWithSqft.reduce((s, c) => s + c.price / c.sqft, 0) / compsWithSqft.length
        : null;

      const avgDom = compsWithDom.length > 0
        ? Math.round(compsWithDom.reduce((s, c) => s + (c.daysOnMarket ?? 0), 0) / compsWithDom.length)
        : null;

      // Determine market condition score (0-100, higher = seller's market)
      let marketCondition: "seller" | "balanced" | "buyer" = "balanced";
      let marketLabel = "Balanced Market";
      let marketScore = 50;
      if (avgDom != null) {
        if (avgDom < 30) {
          marketCondition = "seller";
          marketLabel = "Seller's Market";
          // 0 DOM = 95, 30 DOM = 55
          marketScore = Math.round(95 - (avgDom / 30) * 40);
        } else if (avgDom > 60) {
          marketCondition = "buyer";
          marketLabel = "Buyer's Market";
          // 60 DOM = 45, 180 DOM = 5
          marketScore = Math.max(5, Math.round(45 - ((avgDom - 60) / 120) * 40));
        } else {
          // 30-60 DOM: score between 55-45
          marketScore = Math.round(55 - ((avgDom - 30) / 30) * 10);
        }
      }

      return {
        count: n,
        avgPrice,
        medPrice,
        minPrice: prices[0],
        maxPrice: prices[n - 1],
        avgPpsf: avgPpsf ? Math.round(avgPpsf) : null,
        avgDom,
        marketCondition,
        marketLabel,
        marketScore,
      };
    }, [allComparables]);

  return (
    <div className="space-y-6">
      {/* Subject Property Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subject Property</CardTitle>
        </CardHeader>
        <CardContent>
          {subjectProperty.photo && (
            <div className="mb-4 rounded-lg overflow-hidden w-full aspect-[16/9]">
              <img
                src={subjectProperty.photo}
                alt={subjectProperty.address}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="font-semibold text-sm">{subjectProperty.address}</p>
            </div>
            {subjectProperty.propertyType && (
              <div>
                <p className="text-xs text-muted-foreground">Property Type</p>
                <p className="font-semibold text-sm">
                  {subjectProperty.propertyType}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Beds / Baths</p>
              <p className="font-semibold text-sm">
                {subjectProperty.beds ?? "—"} bed /{" "}
                {subjectProperty.baths ?? "—"} bath
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sq Ft</p>
              <p className="font-semibold text-sm">
                {formatNumber(subjectProperty.sqft)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Year Built</p>
              <p className="font-semibold text-sm">
                {subjectProperty.yearBuilt ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lot Size</p>
              <p className="font-semibold text-sm">
                {subjectProperty.lotSize
                  ? `${formatNumber(subjectProperty.lotSize)} sq ft`
                  : "—"}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Note: Beds, baths, and square footage are inferred from the most
            similar comparable. Subject property details are not provided by
            the AVM.
          </p>
        </CardContent>
      </Card>

      {/* Estimated Value Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">
              Estimated Market Value
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-primary">
              {formatPrice(midpoint)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Range: {formatPrice(estimate.priceRangeLow)} —{" "}
              {formatPrice(estimate.priceRangeHigh)}
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              Computed from {allComparables.length} comparable listings using
              a weighted blend of size-adjusted price-per-square-foot and
              statistical median, with outlier filtering for accuracy.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Market Stats Summary */}
      {marketStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg $/Sq Ft</p>
                <p className="text-lg font-bold text-foreground">
                  {marketStats.avgPpsf ? formatPrice(marketStats.avgPpsf) : "—"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Median Price</p>
                <p className="text-lg font-bold text-foreground">
                  {formatPrice(marketStats.medPrice)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Market Condition</p>
                <p className="text-lg font-bold whitespace-nowrap" style={{
                  color: marketStats.marketCondition === "seller" ? "#16a34a" :
                         marketStats.marketCondition === "buyer" ? "#dc2626" : "#f59e0b"
                }}>
                  {marketStats.marketLabel} ({marketStats.marketScore}/100)
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Avg Days on Market</p>
                <p className="text-lg font-bold text-foreground">
                  {marketStats.avgDom != null ? `${marketStats.avgDom} days` : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sold Comparables */}
      <ComparableSection
        title={`Recently Sold Properties (${soldComparables.length}) — closed sales`}
        comparables={soldComparables}
        formatPrice={formatPrice}
        formatNumber={formatNumber}
        correlationPercent={correlationPercent}
        statusBadge={statusBadge}
      />

      {/* Active Listings */}
      <ComparableSection
        title={`Active Listings (${activeComparables.length}) — currently for sale`}
        comparables={activeComparables}
        formatPrice={formatPrice}
        formatNumber={formatNumber}
        correlationPercent={correlationPercent}
        statusBadge={statusBadge}
      />

    </div>
  );
}