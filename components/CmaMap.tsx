"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CMAReportData } from "@/lib/cma";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface CmaMapProps {
  reportData: CMAReportData;
}

// Fix default Leaflet marker icon paths for bundlers
function fixLeafletIcon() {
  delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const subjectIcon = new L.DivIcon({
  className: "",
  html: '<div style="background:#2563eb;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;border:3px solid #1d4ed8;box-shadow:0 2px 8px rgba(0,0,0,0.3)">★</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const compIcon = (isSold: boolean) =>
  new L.DivIcon({
    className: "",
    html: `<div style="background:${isSold ? "#dc2626" : "#16a34a"};color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:2px solid ${isSold ? "#b91c1c" : "#15803d"};box-shadow:0 1px 5px rgba(0,0,0,0.3)">${isSold ? "S" : "A"}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

export default function CmaMap({ reportData }: CmaMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    fixLeafletIcon();

    const allComps = [
      ...reportData.soldComparables,
      ...reportData.activeComparables,
    ];

    // Find center of all points
    const points: [number, number][] = [];
    if (
      reportData.subjectProperty.latitude &&
      reportData.subjectProperty.longitude
    ) {
      points.push([
        reportData.subjectProperty.latitude,
        reportData.subjectProperty.longitude,
      ]);
    }
    for (const comp of allComps) {
      if (comp.latitude && comp.longitude) {
        points.push([comp.latitude, comp.longitude]);
      }
    }

    if (points.length === 0) return;

    const map = L.map(mapContainerRef.current).fitBounds(
      L.latLngBounds(points),
      { padding: [30, 30] }
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    // Subject marker
    if (
      reportData.subjectProperty.latitude &&
      reportData.subjectProperty.longitude
    ) {
      L.marker(
        [
          reportData.subjectProperty.latitude,
          reportData.subjectProperty.longitude,
        ],
        { icon: subjectIcon }
      )
        .addTo(map)
        .bindPopup(
          `<b>🏠 Subject Property</b><br/>${reportData.subjectProperty.address}`
        );
    }

    // Comparable markers
    allComps.forEach((comp) => {
      if (comp.latitude && comp.longitude) {
        const marker = L.marker([comp.latitude, comp.longitude], {
          icon: compIcon(comp.isSold),
        }).addTo(map);

        const popupContent = [
          `<b>${comp.isSold ? "✅ Sold/Inactive" : "⚠️ Active/Pending"}</b>`,
          comp.address,
          `Price: ${new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(comp.price)}`,
          `${comp.beds} bed / ${comp.baths} bath · ${comp.sqft.toLocaleString()} sq ft`,
          comp.distance !== null ? `${comp.distance.toFixed(1)} mi away` : "",
          `Match: ${Math.round(comp.correlation * 100)}%`,
        ]
          .filter(Boolean)
          .join("<br/>");

        marker.bindPopup(popupContent);
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [reportData]);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">📍 Property Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={mapContainerRef}
          className="w-full h-[350px] sm:h-[400px] rounded-lg border"
        />
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-600 border border-blue-800" />{" "}
            Subject
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-red-600 border border-red-800" />{" "}
            S - Sold
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-green-600 border border-green-800" />{" "}
            A - Active
          </span>
        </div>
      </CardContent>
    </Card>
  );
}