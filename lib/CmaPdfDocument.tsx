import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { CMAReportData, RENOVATION_OPTIONS } from "@/lib/cma";

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf",
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Inter", fontSize: 9, color: "#1a1a1a" },
  header: { marginBottom: 14, borderBottom: "2px solid #e5e7eb", paddingBottom: 10 },
  title: { fontSize: 20, fontWeight: 700, color: "#111827" },
  subtitle: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#111827", marginTop: 14, marginBottom: 6, paddingBottom: 3, borderBottom: "1px solid #e5e7eb" },
  card: { backgroundColor: "#f9fafb", padding: 10, borderRadius: 4, marginBottom: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  col: { flex: 1, minWidth: "22%", marginBottom: 4 },
  label: { fontSize: 6, color: "#6b7280", textTransform: "uppercase", marginBottom: 1 },
  value: { fontSize: 9, fontWeight: 600, color: "#111827" },
  note: { fontSize: 6, color: "#9ca3af", marginTop: 4 },
  estimateBox: { backgroundColor: "#eef2ff", padding: 12, borderRadius: 4, textAlign: "center", marginBottom: 10 },
  estimateLabel: { fontSize: 8, color: "#6b7280", marginBottom: 1 },
  estimateValue: { fontSize: 24, fontWeight: 700, color: "#4338ca" },
  estimateRange: { fontSize: 8, color: "#6b7280", marginTop: 3 },
  table: { marginTop: 6 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 4, paddingHorizontal: 6, borderRadius: 3, marginBottom: 2 },
  tableRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottom: "1px solid #f3f4f6" },
  thText: { fontSize: 6, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" },
  tdText: { fontSize: 7, color: "#374151" },
  colAddr: { flex: 2.5 },
  colType: { flex: 1 },
  colStatus: { flex: 1 },
  colPrice: { flex: 1.2, textAlign: "right" },
  colBeds: { flex: 0.5, textAlign: "center" },
  colBaths: { flex: 0.5, textAlign: "center" },
  colSqft: { flex: 0.8, textAlign: "right" },
  colDist: { flex: 0.7, textAlign: "right" },
  colDom: { flex: 0.5, textAlign: "right" },
  colMatch: { flex: 0.6, textAlign: "right" },
  disclaimer: { marginTop: 16, fontSize: 6, color: "#9ca3af", textAlign: "center", borderTop: "1px solid #e5e7eb", paddingTop: 10 },
  footer: { position: "absolute", bottom: 16, left: 36, right: 36, fontSize: 6, color: "#9ca3af", textAlign: "center" },
  soldBadge: { backgroundColor: "#f3f4f6", color: "#374151", fontSize: 6, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  activeBadge: { backgroundColor: "#fef9c3", color: "#854d0e", fontSize: 6, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 },
  analysisText: { fontSize: 8, color: "#374151", lineHeight: 1.5, marginBottom: 4 },
  renovationRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: "1px solid #f3f4f6", fontSize: 8 },
  renovationTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, marginTop: 4, borderTop: "1px solid #e5e7eb", fontSize: 9, fontWeight: 700 },
  mapNote: { fontSize: 7, color: "#6b7280", marginTop: 6 },
});

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price);
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

interface RenovationPdfData {
  renovations: Record<string, number>;
  adjustedValue: number;
  addedValue: number;
  totalSpent: number;
}

interface CmaPdfProps {
  reportData: CMAReportData;
  aiAnalysis?: string | null;
  renovationData?: RenovationPdfData | null;
}

export function CmaPdfDocument({ reportData, aiAnalysis, renovationData }: CmaPdfProps) {
  const { subjectProperty, estimate, soldComparables, activeComparables } = reportData;
  const allComparables = [...soldComparables, ...activeComparables];

  const selectedRenovations = renovationData?.renovations
    ? Object.entries(renovationData.renovations)
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => {
          const opt = RENOVATION_OPTIONS.find((o) => o.key === key);
          return { label: opt?.label ?? key, roi: opt?.roiPercent ?? 0, amount };
        })
    : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CMA Report</Text>
          <Text style={styles.subtitle}>Comparative Market Analysis — Generated by Domuzz</Text>
        </View>

        {/* Subject Property */}
        <Text style={styles.sectionTitle}>Subject Property</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{subjectProperty.address}</Text>
            </View>
            {subjectProperty.propertyType && (
              <View style={styles.col}>
                <Text style={styles.label}>Type</Text>
                <Text style={styles.value}>{subjectProperty.propertyType}</Text>
              </View>
            )}
            <View style={styles.col}>
              <Text style={styles.label}>Beds / Baths</Text>
              <Text style={styles.value}>{subjectProperty.beds ?? "—"} bed / {subjectProperty.baths ?? "—"} bath</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Square Footage</Text>
              <Text style={styles.value}>{formatNumber(subjectProperty.sqft)}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>Year Built</Text>
              <Text style={styles.value}>{subjectProperty.yearBuilt ?? "—"}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Lot Size</Text>
              <Text style={styles.value}>{subjectProperty.lotSize ? `${formatNumber(subjectProperty.lotSize)} sq ft` : "—"}</Text>
            </View>
          </View>
          <Text style={styles.note}>(Beds, baths, and square footage are inferred from the most similar comparable)</Text>
        </View>

        {/* Estimated Value */}
        <View style={styles.estimateBox}>
          <Text style={styles.estimateLabel}>Estimated Market Value</Text>
          <Text style={styles.estimateValue}>{formatPrice(estimate.price)}</Text>
          <Text style={styles.estimateRange}>Range: {formatPrice(estimate.priceRangeLow)} – {formatPrice(estimate.priceRangeHigh)}</Text>
        </View>

        {/* Adjusted Estimate */}
        {renovationData && renovationData.totalSpent > 0 && (
          <>
            <Text style={styles.sectionTitle}>Adjusted Value (with Renovations)</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>Base Estimate</Text>
                  <Text style={styles.value}>{formatPrice(estimate.price)}</Text>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Added Value</Text>
                  <Text style={{ ...styles.value, color: "#16a34a" }}>+{formatPrice(renovationData.addedValue)}</Text>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Total Spent</Text>
                  <Text style={styles.value}>{formatPrice(renovationData.totalSpent)}</Text>
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Adjusted Estimate</Text>
                  <Text style={{ ...styles.value, color: "#4338ca", fontSize: 12 }}>{formatPrice(renovationData.adjustedValue)}</Text>
                </View>
              </View>
              {selectedRenovations.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  {selectedRenovations.map((r, i) => (
                    <View style={styles.renovationRow} key={i}>
                      <Text>{r.label} (~{r.roi}% ROI)</Text>
                      <Text>Spent: {formatPrice(r.amount)}</Text>
                    </View>
                  ))}
                  <View style={styles.renovationTotal}>
                    <Text>Total Adjusted Value</Text>
                    <Text>{formatPrice(renovationData.adjustedValue)}</Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* AI Analysis */}
        {aiAnalysis && (
          <>
            <Text style={styles.sectionTitle}>AI Market Analysis</Text>
            <View style={styles.card}>
              {aiAnalysis.split(/\n\s*\n/).map((p, i) => (
                <Text key={i} style={styles.analysisText}>{p.replace(/\s+/g, " ").trim()}</Text>
              ))}
            </View>
          </>
        )}

        {/* Comparables */}
        <Text style={styles.sectionTitle}>
          Comparable Properties ({allComparables.length})
          {activeComparables.length > 0 ? " — includes active listings" : ""}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.colAddr]}>Address</Text>
            <Text style={[styles.thText, styles.colType]}>Type</Text>
            <Text style={[styles.thText, styles.colStatus]}>Status</Text>
            <Text style={[styles.thText, styles.colPrice]}>Price</Text>
            <Text style={[styles.thText, styles.colBeds]}>Bed</Text>
            <Text style={[styles.thText, styles.colBaths]}>Bath</Text>
            <Text style={[styles.thText, styles.colSqft]}>Sq Ft</Text>
            <Text style={[styles.thText, styles.colDist]}>Dist</Text>
            <Text style={[styles.thText, styles.colDom]}>DOM</Text>
            <Text style={[styles.thText, styles.colMatch]}>Match</Text>
          </View>
          {allComparables.map((comp, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tdText, styles.colAddr]}>{comp.address}</Text>
              <Text style={[styles.tdText, styles.colType]}>{comp.propertyType ?? "—"}</Text>
              <View style={styles.colStatus}>
                {comp.isSold ? <Text style={styles.soldBadge}>Inactive</Text> : <Text style={styles.activeBadge}>{comp.status}</Text>}
              </View>
              <Text style={[styles.tdText, styles.colPrice]}>{formatPrice(comp.price)}</Text>
              <Text style={[styles.tdText, styles.colBeds]}>{comp.beds}</Text>
              <Text style={[styles.tdText, styles.colBaths]}>{comp.baths}</Text>
              <Text style={[styles.tdText, styles.colSqft]}>{formatNumber(comp.sqft)}</Text>
              <Text style={[styles.tdText, styles.colDist]}>{comp.distance !== null ? `${comp.distance.toFixed(1)} mi` : "—"}</Text>
              <Text style={[styles.tdText, styles.colDom]}>{comp.daysOnMarket !== null ? comp.daysOnMarket : "—"}</Text>
              <Text style={[styles.tdText, styles.colMatch]}>{Math.round(comp.correlation * 100)}%</Text>
            </View>
          ))}
        </View>

        <Text style={styles.mapNote}>All comparable locations are shown on the interactive map at domuzz.com/cma</Text>

        <Text style={styles.disclaimer}>
          This estimate is generated by an automated valuation model (AVM) using public and listing data. It is not a formal appraisal. Consult a licensed appraiser for financing decisions. Data sourced from RentCast and public records.
        </Text>

        <Text style={styles.footer}>
          Generated by Domuzz — domuzz.com — {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}