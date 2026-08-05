import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const prisma = getPrisma();
    const report = await prisma.cmaReport.findUnique({
      where: { slug },
    });

    if (!report) {
      return NextResponse.json(
        { error: "CMA report not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      slug: report.slug,
      address: report.address,
      reportData: report.reportData,
      aiAnalysis: report.aiAnalysis,
      createdAt: report.createdAt,
    });
  } catch (error) {
    console.error("CMA report fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CMA report." },
      { status: 500 }
    );
  }
}
