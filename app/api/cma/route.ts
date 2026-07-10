import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { normalizeRentCastResponse, RentCastResponse } from "@/lib/cma";

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

    const apiKey = process.env.RENTCAST_API_KEY;

    if (!apiKey || apiKey === "your_rentcast_api_key_here") {
      return NextResponse.json(
        { error: "RentCast API key is not configured on the server." },
        { status: 500 }
      );
    }

    // Call RentCast AVM value endpoint (GET with X-API-Key)
    const rentCastUrl = `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address.trim())}`;

    const rcResponse = await fetch(rentCastUrl, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
      },
    });

    if (rcResponse.status === 429) {
      return NextResponse.json(
        { error: "RentCast API rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    if (!rcResponse.ok) {
      const errorText = await rcResponse.text();
      console.error("RentCast API error:", rcResponse.status, errorText);
      return NextResponse.json(
        {
          error:
            "Unable to generate a CMA report for this address. The address may be invalid or outside the coverage area.",
        },
        { status: rcResponse.status }
      );
    }

    const data: RentCastResponse = await rcResponse.json();

    // RentCast returns 405 with nested error for method issues
    if ((data as unknown as { status?: number }).status === 405) {
      return NextResponse.json(
        {
          error:
            "Unable to generate a CMA report for this address. The address may be invalid or outside the coverage area.",
        },
        { status: 405 }
      );
    }

    // Check if we have comparables
    if (!data.comparables || data.comparables.length === 0) {
      return NextResponse.json(
        {
          error:
            "No comparable properties found for this address. Try a different address or check that the property is in a supported area.",
        },
        { status: 404 }
      );
    }

    // Normalize the response
    const normalized = normalizeRentCastResponse(data);

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