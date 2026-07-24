import { NextRequest } from "next/server";
import { scrapeByAddresses } from "@/lib/apify";
import { normalize } from "@/lib/normalize";
import { compareHouses } from "@/lib/ai";
import { estimateSystemAges } from "@/lib/systems";

export const maxDuration = 300;
export const runtime = "nodejs";

function emit(controller: ReadableStreamDefaultController, event: string, data: Record<string, unknown>) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  try {
    const { addresses, weights, userProfile, noGoFilters } = await req.json();

    // Validate
    if (!Array.isArray(addresses) || addresses.length < 1 || addresses.length > 3) {
      return new Response(JSON.stringify({ error: "Send 1–3 US property addresses" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userProfile) {
      return new Response(JSON.stringify({ error: "Financial profile (income + credit score) is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (typeof userProfile.income !== "number" || userProfile.income < 0)
      return new Response(JSON.stringify({ error: "Invalid annual income" }), { status: 400, headers: { "Content-Type": "application/json" } });
    if (typeof userProfile.creditScore !== "number" || userProfile.creditScore < 300 || userProfile.creditScore > 850)
      return new Response(JSON.stringify({ error: "Credit score must be between 300 and 850" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const trimmedAddresses = addresses.map((a: string) => a.trim()).filter(Boolean);
    if (trimmedAddresses.length === 0) {
      return new Response(JSON.stringify({ error: "Enter at least one valid US property address" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let aborted = false;

        // Handle client disconnect
        const abortHandler = () => { aborted = true; };
        req.signal.addEventListener("abort", abortHandler);

        try {
          // Stage 1: Scraping
          emit(controller, "progress", { stage: "scraping", message: `Fetching data for ${trimmedAddresses.length} propert${trimmedAddresses.length > 1 ? "ies" : "y"}...`, progress: 5 });
          if (aborted) return;

          const raw = await scrapeByAddresses(trimmedAddresses);
          if (aborted) return;
          emit(controller, "progress", { stage: "scraping", message: "Property data fetched", progress: 20 });

          // Stage 2: Normalizing
          emit(controller, "progress", { stage: "normalizing", message: "Processing property details...", progress: 25 });
          if (aborted) return;

          const houses = raw.map(normalize);

          // Attach system age estimates (roof, HVAC, water heater)
          const currentYear = new Date().getFullYear();
          for (const house of houses) {
            house.systemAges = estimateSystemAges(house, currentYear);
          }

          if (aborted) return;
          emit(controller, "progress", { stage: "normalizing", message: `Processed ${houses.length} propert${houses.length > 1 ? "ies" : "y"}`, progress: 35 });

          // Stage 3: AI comparison
          let aiResult = null;
          if (process.env.GEMINI_API) {
            emit(controller, "progress", { stage: "ai", message: "Analyzing properties with AI...", progress: 40 });
            if (aborted) return;

            aiResult = await compareHouses(houses, false, weights ?? {}, userProfile ?? null, noGoFilters ?? null);
            if (aborted) return;
            emit(controller, "progress", { stage: "ai", message: "AI analysis complete", progress: 60 });
          } else {
            emit(controller, "progress", { stage: "ai", message: "AI skipped (no API key)", progress: 60 });
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
              if (violations.length > 0) {
                noGoViolations[h.address] = violations;
              }
            }
          }

          emit(controller, "progress", { stage: "ai", message: "AI analysis complete", progress: 90 });

          // Send final result
          const result = {
            houses,
            aiResult,
            notes: {},
            noGoViolations,
            commutes: [],
            amenities: [],
          };

          const skippedStages: Record<string, boolean> = {};

          emit(controller, "done", { skippedStages, ...result });
          controller.close();
        } catch (error: any) {
          console.error("Compare stream error:", error);
          const stage = "processing";
          emit(controller, "error", {
            stage,
            message: error?.message ?? "An unexpected error occurred",
          });
          controller.close();
        } finally {
          req.signal.removeEventListener("abort", abortHandler);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Compare API error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}