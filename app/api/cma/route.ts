import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { scrapeCmaComps } from "@/lib/apify";
import { normalizeApifyCmaResponse } from "@/lib/cma";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per hour per IP
    const ip = getClientIP(request);
    const rateLimitResult = checkRateLimit(ip, 5, 60 * 60 * 1000);

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil(
            (rateLimitResult.resetAt - Date.now()) / 1000
          ),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            ),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address || address.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid US property address is required." },
        { status: 400 }
      );
    }

    const apifyToken = process.env.APIFY_TOKEN;

    if (!apifyToken || apifyToken === "your_apify_token_here") {
      return NextResponse.json(
        { error: "Apify API token is not configured on the server." },
        { status: 500 }
      );
    }

    // Use Apify Zillow detail scraper — request 20 items each
    // from RECENTLY_SOLD and FOR_SALE to get area comparables
    const rawResults = await scrapeCmaComps(address.trim());

    if (!rawResults || rawResults.length === 0) {
      return NextResponse.json(
        {
          error:
            "No comparable properties found for this address. Try a different address or check that the property is in a supported area.",
        },
        { status: 404 }
      );
    }

    // Normalize the Apify response into CMA report format
    const normalized = normalizeApifyCmaResponse(address.trim(), rawResults);

    if (!normalized.soldComparables.length && !normalized.activeComparables.length) {
      return NextResponse.json(
        {
          error:
            "No comparable properties found for this address. Try a different address or check that the property is in a supported area.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(normalized, {
      headers: {
        "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      },
    });
  } catch (error) {
    console.error("CMA API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
