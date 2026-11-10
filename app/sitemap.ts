import { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteUrl;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/cma`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/compare`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/fsbo`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  // Fetch all CMA report slugs from the database
  let cmaRoutes: MetadataRoute.Sitemap = [];
  try {
    const { getPrisma } = await import("@/lib/prisma");
    const prisma = getPrisma();
    const reports = await prisma.cmaReport.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    cmaRoutes = reports.map((r) => ({
      url: `${baseUrl}/cma/${r.slug}`,
      lastModified: r.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch (err) {
    console.error("Sitemap: Failed to fetch CMA report slugs:", err);
  }

  return [...staticRoutes, ...cmaRoutes];
}
