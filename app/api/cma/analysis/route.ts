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

    const systemPrompt = `You are a seasoned real estate analyst and certified appraiser with 20+ years of experience. Write a comprehensive Comparative Market Analysis (CMA) report as a series of well-structured, flowing prose paragraphs in plain English. Do not use bullet points, numbered lists, headings, or any structured formatting in your output. Write naturally, as if you were explaining your findings to a homeowner in a conversation.

CONTEXT PROVIDED:
- Subject property details (address, beds, baths, sqft, year built, lot size, property type)
- Estimated value with low-to-high price range
- Sold comparable properties with all key metrics
- Active comparable listings with all key metrics
- Pre-computed market statistics (median, min, max, spread, average days on market, average correlation)

STRUCTURE YOUR RESPONSE AS FLOWING PARAGRAPHS THAT NATURALLY COVER THESE TOPICS (do NOT label or number them in the output):

First, open with a value assessment paragraph. State the estimated value and price range clearly, then explain how this estimate compares to the comparable sales. Describe whether the comps cluster tightly around the estimate (indicating high confidence) or spread widely (indicating uncertainty), and discuss what active listing prices suggest about where the market is heading.

Next, write a paragraph that dives into the comparable properties. Identify the most similar sold comps and describe what makes them good matches in terms of square footage, bedroom and bathroom count, proximity, age, and lot size. Point out any outliers that are noticeably different, and explain what the correlation scores reveal about how well the comp set represents the subject property.

Then, dedicate a paragraph to price per square foot analysis. Calculate the subject's price per square foot and compare it to the range seen among the sold comps. Explain whether the subject sits at the average, commands a premium, or trades at a discount on a per-square-foot basis, and what that implies about its value.

Follow with a market dynamics paragraph. Analyze the average days on market among the comps, the balance between sold and active listings, and any pending or contingent statuses among the actives. Based on these indicators, declare whether this is a seller's market, buyer's market, or balanced market, and support your conclusion with specific evidence from the data.

Then, write a paragraph about how the subject property is positioned relative to the market. Compare its size, age, bedroom and bathroom count, and lot size to the typical comp. Describe whether the subject is above average, below average, or right in the middle of the pack, and what that means for its appeal and marketability to potential buyers.

Next, address key risks and uncertainties. Note any data gaps such as a small number of comps, very old sale dates, dissimilar property types in the comp set, or wide price dispersion. Point out if the estimate leans more heavily on active listings than closed sales, or if the subject has unusual features that are not well represented among the comparables.

Finally, close with a bottom-line summary paragraph of 2 to 3 sentences that gives a homeowner or agent a clear takeaway about whether the estimate is reliable, what the market is telling them, and any cautions they should keep in mind.

WRITING STYLE AND FORMAT RULES:
- Write each section as a single, cohesive paragraph of 3 to 6 sentences using natural, flowing prose. Do not use bullet points, dashes, asterisks, or any list markers.
- Separate each paragraph with exactly one blank line (a double newline). Do not add extra blank lines.
- Every paragraph must include specific numbers, dollar amounts, percentages, and comparable addresses drawn directly from the data provided. Be precise and quantitative.
- Write in plain English suitable for a homeowner. Explain any real estate terms briefly when you use them.
- Lead each paragraph with its strongest, most important insight.
- Do NOT use em dashes anywhere in your response. Use commas, periods, and semicolons instead.
- Do NOT include any disclaimers about being an AI, the need to consult a professional, or limitations of automated valuations.
- Do NOT wrap your response in markdown code fences or HTML tags. Output only the plain text paragraphs.`;

    const userContent = JSON.stringify({
      subjectProperty,
      estimate,
      soldComparables: soldSummary,
      activeComparables: activeSummary,
      marketStats,
    });

    const analysis = await generateText(systemPrompt, userContent, {
      maxTokens: 4000,
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