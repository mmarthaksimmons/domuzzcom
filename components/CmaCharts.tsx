"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { CMAReportData } from "@/lib/cma";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from "recharts";

interface CmaChartsProps {
  reportData: CMAReportData;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatPriceShort(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price}`;
}

export default function CmaCharts({ reportData }: CmaChartsProps) {
  const allComps = useMemo(
    () => [...reportData.soldComparables, ...reportData.activeComparables],
    [reportData]
  );

  const domData = useMemo(
    () =>
      allComps.map((c) => ({
        name: c.address.split(",")[0].replace(/\d+\s+/, "").slice(0, 18),
        dom: c.daysOnMarket ?? 0,
        status: c.isSold ? "Sold/Inactive" : "Active",
        fullAddress: c.address,
        price: c.price,
      })),
    [allComps]
  );

  const scatterData = useMemo(
    () =>
      allComps.map((c) => ({
        x: c.sqft,
        y: c.price,
        name: c.address.split(",")[0].slice(0, 18),
        status: c.isSold ? "Sold" : "Active",
      })),
    [allComps]
  );

  const compPrices = useMemo(
    () =>
      allComps
        .map((c) => c.price)
        .sort((a, b) => a - b),
    [allComps]
  );

  const priceStats = useMemo(() => {
    if (compPrices.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = compPrices[0];
    const max = compPrices[compPrices.length - 1];
    const avg = compPrices.reduce((s, p) => s + p, 0) / compPrices.length;
    return { min, max, avg };
  }, [compPrices]);

  const priceRangeData = useMemo(() => {
    const e = reportData.estimate;
    return [
      { name: "Comp Min", value: priceStats.min },
      { name: "Comp Avg", value: priceStats.avg },
      { name: "Subject Est.", value: e.price },
      { name: "Comp Max", value: priceStats.max },
    ];
  }, [priceStats, reportData.estimate]);

  return (
    <div className="space-y-6 mt-6">
      {/* Days on Market Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Days on Market Comparison
          </CardTitle>
          <CardDescription>
            How long each comparable stayed on the market
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={domData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 10 }} label={{ value: "Days", position: "insideLeft", angle: -90, fontSize: 10 }} />
              <Tooltip
                formatter={(value) => [`${value} days`, "DOM"]}
                labelFormatter={(label) => {
                  const item = domData.find((d) => d.name === label);
                  return item?.fullAddress ?? String(label);
                }}
              />
              <Bar
                dataKey="dom"
                radius={[4, 4, 0, 0]}
                fill="var(--color-primary)"
                fillOpacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Price vs SqFt Scatter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Price vs Square Footage
          </CardTitle>
          <CardDescription>
            See how the subject estimate compares to actual comps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="x"
                type="number"
                name="Sq Ft"
                unit=" ft2"
                tick={{ fontSize: 10 }}
                label={{ value: "Square Feet", position: "bottom", fontSize: 10, offset: -5 }}
              />
              <YAxis
                dataKey="y"
                type="number"
                name="Price"
                tick={{ fontSize: 10 }}
                tickFormatter={formatPriceShort}
                label={{ value: "Price", position: "insideLeft", angle: -90, fontSize: 10 }}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "Sq Ft") return [`${Number(value).toLocaleString()} ft2`, name];
                  return [formatPrice(Number(value)), "Price"];
                }}
              />
              <Legend />
              <Scatter
                name="Sold/Inactive"
                data={scatterData.filter((d) => d.status === "Sold")}
                fill="#16a34a"
              />
              <Scatter
                name="Active"
                data={scatterData.filter((d) => d.status === "Active")}
                fill="#ca8a04"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Price Distribution Bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Price Distribution
          </CardTitle>
          <CardDescription>
            Subject estimate positioned against comparable price range
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priceRangeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={formatPriceShort} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [formatPrice(Number(value)), "Price"]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priceRangeData.map((entry, idx) => {
                  const color =
                    entry.name === "Subject Est."
                      ? "var(--color-primary)"
                      : entry.name === "Comp Min"
                      ? "#f59e0b"
                      : entry.name === "Comp Max"
                      ? "#ef4444"
                      : "#6b7280";
                  return <rect key={idx} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}