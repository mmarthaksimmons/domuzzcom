import { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageParams {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const readable = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return {
    title: `${readable} — Free CMA Report | Domuzz`,
    description: `Free Comparative Market Analysis for ${readable}. See estimated value, sold comparables, and market trends.`,
  };
}

export default function CmaReportPermalinkPage() {
  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>CMA Report</h1>
      <p>Loading report data...</p>
      <p>
        <a href="/cma">← Generate New Report</a>
      </p>
    </main>
  );
}
