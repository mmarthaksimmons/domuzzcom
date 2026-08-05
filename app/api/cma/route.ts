import { NextRequest } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { scrapeCmaComps } from "@/lib/apify";
import { normalizeApifyCmaResponse } from "@/lib/cma";
import { generateAddressSlug } from "@/lib/utils";

export const maxDuration = 300;
export const runtime = "nodejs";

async function saveCmaReport(
  slug: string,
  address: string,
  reportData: Record<string, unknown>
) {
  try {
    const { getPrisma } = await import("@/lib/prisma");
    const prisma = getPrisma();
    await prisma.cmaReport.upsert({
      where: { slug },
      update: {
        reportData: reportData as any,
        address,
      },
      create: {
        slug,
        address,
        reportData: reportData as any,
      },
    });
  } catch (err) {
    console.error("Failed to save CMA report:", err);
  }
}

function emit(
  controller: ReadableStreamDefaultController,
  event: string,
  data: Record<string, unknown>
) {
  controller.enqueue(
    new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  );
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const rateLimitResult = checkRateLimit(ip, 5, 60 * 60 * 1000);

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || address.trim().length === 0) {
    return new Response(JSON.stringify({ error: "A valid US property address is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken || apifyToken === "your_apify_token_here") {
    return new Response(JSON.stringify({ error: "Apify API token is not configured on the server." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false;

      const abortHandler = () => {
        aborted = true;
      };
      request.signal.addEventListener("abort", abortHandler);

      try {
        // Stage 1: Subject property lookup
        emit(controller, "progress", {
          stage: "detail",
          message: "Looking up subject property...",
          progress: 5,
        });
        if (aborted) return;

        const { results: rawResults, soldResults: rawSold } =
          await scrapeCmaComps(address.trim());
        if (aborted) return;

        emit(controller, "progress", {
          stage: "detail",
          message: "Subject property found",
          progress: 25,
        });

        // Stage 2: Searching area comparables
        emit(controller, "progress", {
          stage: "search",
          message: `Active comparables found: ${Math.max(0, rawResults.length - 1)}, Sold comparables found: ${rawSold.length}`,
          progress: 50,
        });
        if (aborted) return;

        // Stage 3: Computing estimate
        emit(controller, "progress", {
          stage: "estimate",
          message: "Computing property estimate...",
          progress: 75,
        });

        const normalized = normalizeApifyCmaResponse(
          address.trim(),
          rawResults,
          rawSold
        );
        if (aborted) return;

        // Persist the report to Neon so it's accessible via permalink
        const slug = generateAddressSlug(normalized.subjectProperty.address);
        const reportPayload = {
          subjectProperty: normalized.subjectProperty,
          estimate: normalized.estimate,
          soldComparables: normalized.soldComparables,
          activeComparables: normalized.activeComparables,
        };
        saveCmaReport(slug, normalized.subjectProperty.address, reportPayload);

        emit(controller, "progress", {
          stage: "estimate",
          message: "Estimate computed",
          progress: 90,
        });

        // Send final result (includes slug for permalink)
        emit(controller, "done", {
          slug,
          soldComparables: normalized.soldComparables,
          activeComparables: normalized.activeComparables,
          subjectProperty: normalized.subjectProperty,
          estimate: normalized.estimate,
        });
        controller.close();
      } catch (error: any) {
        console.error("CMA API error:", error);
        emit(controller, "error", {
          stage: "search",
          message: error?.message ?? "An unexpected error occurred",
        });
        controller.close();
      } finally {
        request.signal.removeEventListener("abort", abortHandler);
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
}