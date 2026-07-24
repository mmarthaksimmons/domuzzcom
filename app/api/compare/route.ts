import { NextRequest, NextResponse } from "next/server";
import { scrapeByAddresses } from "@/lib/apify";
import { normalize } from "@/lib/normalize";
import { compareHouses } from "@/lib/ai";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { addresses, weights, userProfile, noGoFilters } = await req.json();

    // Validate
    if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 3) {
      return NextResponse.json(
        { error: "Send 1–3 US property addresses" },
        { status: 400 }
      );
    }

    // Validate userProfile is required
    if (!userProfile) {
      return NextResponse.json({ error: "Financial profile (income + credit score) is required" }, { status: 400 });
    }
    if (typeof userProfile.income !== "number" || userProfile.income < 0)
      return NextResponse.json({ error: "Invalid annual income" }, { status: 400 });
    if (typeof userProfile.creditScore !== "number" || userProfile.creditScore < 300 || userProfile.creditScore > 850)
      return NextResponse.json({ error: "Credit score must be between 300 and 850" }, { status: 400 });

    const trimmedAddresses = addresses.map((a: string) => a.trim()).filter(Boolean);

    if (trimmedAddresses.length === 0) {
      return NextResponse.json(
        { error: "Enter at least one valid US property address" },
        { status: 400 }
      );
    }

    // Scrape via addresses (Zillow ToS compliant — no URL scraping)
    const raw = await scrapeByAddresses(trimmedAddresses);
    const houses = raw.map(normalize);

    // AI summary (optional — skip if no key set)
    let aiResult = null;
    if (process.env.GEMINI_API) {
      aiResult = await compareHouses(houses, false, weights ?? {}, userProfile ?? null, noGoFilters ?? null);
    }

    // Compute no-go violations per house
    const noGoViolations: Record<string, string[]> = {};
    if (noGoFilters) {
      for (const h of houses) {
        const violations: string[] = [];
        if (noGoFilters.noHoa && h.hoaMonthly != null && h.hoaMonthly > 0) {
          violations.push("HOA present");
        }
        if (noGoFilters.noOffStreetParking && (h.garage == null || h.garage === 0)) {
          violations.push("No off-street parking (no garage)");
        }
        if (noGoFilters.minBeds != null && h.beds != null && h.beds < noGoFilters.minBeds) {
          violations.push(`Fewer than ${noGoFilters.minBeds} bedrooms (has ${h.beds})`);
        }
        if (noGoFilters.minBaths != null && h.baths != null && h.baths < noGoFilters.minBaths) {
          violations.push(`Fewer than ${noGoFilters.minBaths} bathrooms (has ${h.baths})`);
        }
        if (noGoFilters.minSqft != null && h.sqft != null && h.sqft < noGoFilters.minSqft) {
          violations.push(`Below ${noGoFilters.minSqft.toLocaleString()} sqft (${h.sqft.toLocaleString()} sqft)`);
        }
        if (noGoFilters.maxHoaMonthly != null && h.hoaMonthly != null && h.hoaMonthly > noGoFilters.maxHoaMonthly) {
          violations.push(`HOA exceeds $${noGoFilters.maxHoaMonthly}/mo ($${h.hoaMonthly}/mo)`);
        }
        if (noGoFilters.singleStoryOnly && h.stories != null && h.stories > 1) {
          violations.push(`Multi-story (${h.stories} stories)`);
        }
        // noMajorIssues is handled by AI red-flag detection
        if (violations.length > 0) {
          noGoViolations[h.address] = violations;
        }
      }
    }

    return NextResponse.json({
      houses,
      aiResult,
      notes: {},
      noGoViolations,
    });
  } catch (error: any) {
    console.error("Compare API error:", error);
    return NextResponse.json(
      { error: error.message ?? "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
