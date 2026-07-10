import { NextRequest, NextResponse } from "next/server";

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

    const model = "~google/gemini-flash-latest";
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "AI service is not configured." },
        { status: 500 }
      );
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are a seasoned real estate analyst. Analyze the CMA (Comparative Market Analysis) report provided and give a concise, insightful summary.

Focus on:
1. Whether the estimated value seems reasonable compared to the comparables
2. The market context (are comps clustered tightly or widely spread?)
3. What the price range suggests about market uncertainty
4. Any notable patterns in the comparables (size, location, age vs price)
5. Whether this is a seller's or buyer's market based on days-on-market and listing statuses

Keep it under 200 words total. Use plain English. No JSON formatting.

IMPORTANT: Format your response as 2-3 distinct paragraphs separated by a blank line (double newline). Each paragraph should cover a specific insight. Do not lump everything into one block of text. Avoid using em dashes in your response; use commas or periods instead.

Do NOT include any disclaimers about being an AI or consulting professionals.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              subjectProperty: reportData.subjectProperty,
              estimate: reportData.estimate,
              soldComparables: reportData.soldComparables,
              activeComparables: reportData.activeComparables,
            }),
          },
        ],
        max_tokens: 500,
      }),
    });

    const data = await res.json();

    console.log("AI response status:", res.status);

    if (!data.choices?.[0]?.message?.content) {
      console.error("AI response error:", JSON.stringify(data).slice(0, 1000));
      return NextResponse.json(
        { error: "AI service returned an unexpected response." },
        { status: 502 }
      );
    }

    const analysis = data.choices[0].message.content.trim();

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("CMA analysis API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}