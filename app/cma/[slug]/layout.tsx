import { Metadata } from "next";

interface LayoutParams {
  slug: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<LayoutParams>;
}): Promise<Metadata> {
  const { slug } = await params;
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
      description: `Free Comparative Market Analysis for ${readable}.`,
    },
  };
}

export default function CmaReportSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
