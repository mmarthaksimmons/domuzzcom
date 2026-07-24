import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportData } = body;

    if (!reportData) {
      return NextResponse.json(
        { error: "Report data is required." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    // Build rich context about the subject and comparables
    const { subjectProperty, estimate, soldComparables, activeComparables } = reportData;

    const soldSummary = soldComparables?.length
      ? soldComparables.map((c: any) => ({
          address: c.address,
          price: c.price,
          beds: c.beds,
          baths: c.baths,
          sqft: c.sqft,
          yearBuilt: c.yearBuilt,
          lotSize: c.lotSize,
          distance: c.distance,
          daysOnMarket: c.daysOnMarket,
          status: c.status,
          correlation: c.correlation,
          propertyType: c.propertyType,
        }))
      : [];

    const activeSummary = activeComparables?.length
      ? activeComparables.map((c: any) => ({
          address: c.address,
          price: c.price,
          beds: c.beds,
          baths: c.baths,
          sqft: c.sqft,
          yearBuilt: c.yearBuilt,
          lotSize: c.lotSize,
          distance: c.distance,
          daysOnMarket: c.daysOnMarket,
          status: c.status,
          correlation: c.correlation,
          propertyType: c.propertyType,
        }))
      : [];

    // Compute market stats for richer context
    const allCompPrices = [...soldSummary, ...activeSummary]
      .filter((c: any) => c.price > 0)
      .map((c: any) => c.price)
      .sort((a: number, b: number) => a - b);

    const marketStats = {
      totalComps: allCompPrices.length,
      soldCount: soldSummary.length,
      activeCount: activeSummary.length,
      priceMin: allCompPrices[0] ?? null,
      priceMax: allCompPrices[allCompPrices.length - 1] ?? null,
      priceMedian:
        allCompPrices.length > 0
          ? allCompPrices[Math.floor(allCompPrices.length / 2)]
          : null,
      priceSpread:
        allCompPrices.length > 1
          ? allCompPrices[allCompPrices.length - 1] - allCompPrices[0]
          : 0,
      avgDaysOnMarket:
        [...soldSummary, ...activeSummary]
          .filter((c: any) => c.daysOnMarket != null)
          .reduce((s: number, c: any) => s + c.daysOnMarket, 0) /
          [...soldSummary, ...activeSummary].filter((c: any) => c.daysOnMarket != null).length || null,
      avgCorrelation:
        [...soldSummary, ...activeSummary]
          .reduce((s: number, c: any) => s + (c.correlation ?? 0), 0) /
          ([...soldSummary, ...activeSummary].length || 1),
    };

    const systemPrompt = `You are a seasoned real estate analyst. Write a concise Comparative Market Analysis (CMA) summary in plain English prose. Do not use bullet points, numbered lists, headings, or any structured formatting. Write naturally, as if explaining your findings to a homeowner.

CRITICAL: Your entire response MUST be under 300 words. Be brief and to the point.

CONTEXT PROVIDED:
- Subject property details (address, beds, baths, sqft, year built, lot size, property type)
- Estimated value with low-to-high price range
- Sold comparable properties with all key metrics
- Active comparable listings with all key metrics
- Pre-computed market statistics (median, min, max, spread, average days on market, average correlation)

WRITE 3 PARAGRAPHS SEPARATED BY BLANK LINES:

Paragraph 1 (Value & Market Assessment): State the estimated value and range. Compare it to the sold comps — is it near the median, above, or below? Note how tightly or widely comps cluster around it. Briefly assess whether active listing prices suggest the market is rising, falling, or stable.

Paragraph 2 (Comparable Property Insights): Identify the 1-2 most similar sold comps and why they are good matches. Note any notable outliers. Mention what the price-per-sqft and days-on-market data reveal about the subject's positioning and local market dynamics.

Paragraph 3 (Risks & Bottom Line): Note any key data gaps or uncertainties (few comps, wide dispersion, dissimilar properties). Give a 1-2 sentence takeaway on estimate reliability and what the market is telling the owner.

FORMAT RULES:
- Keep the ENTIRE response under 300 words. If you exceed 300 words, truncate your last paragraph to fit.
- Each paragraph should be 2-4 sentences. Be concise.
- Include specific numbers, dollar amounts, and percentages from the data.
- Write in plain English accessible to a homeowner.
- Do NOT use em dashes. Use commas, periods, and semicolons instead.
- Do NOT include any disclaimers about being an AI or consulting professionals.
- Separate paragraphs with exactly one blank line. Do not wrap in markdown or HTML.`;

    const userContent = JSON.stringify({
      subjectProperty,
      estimate,
      soldComparables: soldSummary,
      activeComparables: activeSummary,
      marketStats,
    });

    const analysis = await generateText(systemPrompt, userContent, {
      maxTokens: 800,
      temperature: 0.7,
    });

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("CMA analysis API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}