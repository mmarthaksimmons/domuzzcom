import { Metadata } from "next";
import CmaReportPermalinkClient from "@/components/CmaReportPermalinkClient";

interface PageParams {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Decode the slug back to a readable address for the title
  const readable = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const title = `${readable} — Free CMA Report | Domuzz`;
  const url = `https://www.domuzz.com/cma/${slug}`;

  return {
    title,
    description: `Free Comparative Market Analysis for ${readable}. See estimated value, sold comparables, and market trends — no agent required.`,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: `Free Comparative Market Analysis for ${readable}. See estimated value, sold comparables, and market trends.`,
      url,
      siteName: "Domuzz",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
    },
  };
}

export default async function CmaReportPermalinkPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  return <CmaReportPermalinkClient slug={slug} />;
}
