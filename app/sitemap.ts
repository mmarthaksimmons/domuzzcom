import { MetadataRoute } from "next";
import { getPrisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://www.domuzz.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/cma`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/fsbo`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  // CMA report permalink pages
  let cmaPages: MetadataRoute.Sitemap = [];
  try {
    const prisma = getPrisma();
    const reports = await prisma.cmaReport.findMany({
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    cmaPages = reports.map((report) => ({
      url: `${baseUrl}/cma/${report.slug}`,
      lastModified: report.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }));
  } catch {
    // Table may not exist yet — skip CMA pages in sitemap
  }

  return [...staticPages, ...cmaPages];
}
