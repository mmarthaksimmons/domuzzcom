"use client";

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
        Inactive
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

export default function CmaReport({
  reportData,
}: {
  reportData: CMAReportData;
}) {
  const { subjectProperty, estimate, soldComparables, activeComparables } =
    reportData;
  const midpoint = estimate.price;
  const allComparables = [...soldComparables, ...activeComparables];

  return (
    <div className="space-y-6">
      {/* Subject Property Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subject Property</CardTitle>
        </CardHeader>
        <CardContent>
          {subjectProperty.photo && (
            <div className="mb-4 rounded-lg overflow-hidden max-h-48">
              <img
                src={subjectProperty.photo}
                alt={subjectProperty.address}
                className="w-full h-48 object-cover"
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
              Estimated Value
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-primary">
              {formatPrice(midpoint)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Range: {formatPrice(estimate.priceRangeLow)} —{" "}
              {formatPrice(estimate.priceRangeHigh)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Comparables Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Comparable Properties
            {activeComparables.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (includes active listings — not closed sales)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Address</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Price</TableHead>
                <TableHead className="text-xs text-center">Beds</TableHead>
                <TableHead className="text-xs text-center">Baths</TableHead>
                <TableHead className="text-xs text-right">Sq Ft</TableHead>
                <TableHead className="text-xs text-right">Distance</TableHead>
                <TableHead className="text-xs text-right">DOM</TableHead>
                <TableHead className="text-xs text-right">Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allComparables.map((comp, i) => (
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
                  <TableCell className="text-xs text-right font-mono">
                    {formatPrice(comp.price)}
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    {comp.beds}
                  </TableCell>
                  <TableCell className="text-xs text-center">
                    {comp.baths}
                  </TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {formatNumber(comp.sqft)}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {comp.distance !== null
                      ? `${comp.distance.toFixed(1)} mi`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {comp.daysOnMarket !== null ? comp.daysOnMarket : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right">
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

      {/* Disclaimer */}
      <Card className="border-muted">
        <CardContent className="py-3">
          <p className="text-[11px] sm:text-xs text-muted-foreground italic text-center">
            This estimate is generated by an automated valuation model (AVM)
            using public and listing data. It is not a formal appraisal. Consult
            a licensed appraiser for financing decisions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}