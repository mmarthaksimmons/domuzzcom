import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { CMAReportData } from "@/lib/cma";
import CmaReportPermalinkClient from "@/components/CmaReportPermalinkClient";

interface PageParams {
  slug: string;
}

interface CmaReportRow {
  slug: string;
  address: string;
  reportData: CMAReportData;
  aiAnalysis: string | null;
  createdAt: string;
}

async function getReport(slug: string): Promise<CmaReportRow | null> {
  try {
    const prisma = getPrisma();
    const report = await prisma.cmaReport.findUnique({
      where: { slug },
    });
    if (!report) return null;
    return {
      slug: report.slug,
      address: report.address,
      reportData: report.reportData as unknown as CMAReportData,
      aiAnalysis: report.aiAnalysis,
      createdAt: report.createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const report = await getReport(slug);

  if (!report) {
    return { title: "CMA Report Not Found | Domuzz" };
  }

  const address = report.address;
  const estimate = report.reportData.estimate;
  const price =
    estimate.price > 0
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(estimate.price)
      : null;

  const title = `${address} — Free CMA Report | Domuzz`;
  const description = price
    ? `Free Comparative Market Analysis for ${address}. Estimated value: ${price}. See sold comparables, market trends, and property insights — no agent required.`
    : `Free Comparative Market Analysis for ${address}. See estimated value, sold comparables, market trends, and property insights — no agent required.`;

  const url = `https://www.domuzz.com/cma/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Domuzz",
      type: "website",
      images: [
        {
          url: "https://www.domuzz.com/domuzz_logo.svg",
          width: 800,
          height: 182,
          alt: "Domuzz — Free CMA Reports",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CmaReportPermalinkPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const report = await getReport(slug);

  if (!report) {
    notFound();
  }

  const { address, reportData, aiAnalysis, createdAt } = report;
  const estimate = reportData.estimate;

  // Build JSON-LD structured data for the property
  const priceFormatted =
    estimate.price > 0 ? estimate.price : undefined;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `CMA Report for ${address}`,
    description: `Comparative Market Analysis for ${address}. Estimated value range: $${estimate.priceRangeLow.toLocaleString()} – $${estimate.priceRangeHigh.toLocaleString()}.`,
    url: `https://www.domuzz.com/cma/${slug}`,
    datePosted: createdAt,
    about: {
      "@type": "Place",
      name: address,
      address: {
        "@type": "PostalAddress",
        streetAddress: address,
      },
    },
    ...(priceFormatted && {
      offers: {
        "@type": "Offer",
        price: priceFormatted,
        priceCurrency: "USD",
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CmaReportPermalinkClient
        address={address}
        reportData={reportData}
        aiAnalysis={aiAnalysis}
        createdAt={createdAt}
      />
    </>
  );
}
