import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveLead(data: {
  email: string;
  firstName: string | null;
  address: string;
  reportData: Record<string, unknown>;
}) {
  try {
    const { getPrisma } = await import("@/lib/prisma");
    const prisma = getPrisma();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.lead.create({
      data: {
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName?.trim() || null,
        address: data.address.trim(),
        reportData: data.reportData as any,
        consent: true,
      },
    });
  } catch (dbError: unknown) {
    const err = dbError as { message?: string; code?: string };
    console.error("Prisma save error:", err);
  }
}

async function sendWelcomeEmail(email: string, firstName: string | null) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "hello@domuzz.com";

  if (!resendApiKey || resendApiKey === "your_resend_api_key_here") return;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: `Domuzz <${fromEmail}>`,
      to: [email.trim().toLowerCase()],
      subject: "Welcome to Domuzz! 🏠",
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Hi${firstName ? ` ${firstName}` : ""},</h2>
          <p style="color: #525252; line-height: 1.6;">
            Thank you for using <strong>Domuzz</strong> to generate your free Comparative Market Analysis report.
          </p>
          <p style="color: #525252; line-height: 1.6;">
            We're building free tools to help home buyers and sellers make smarter decisions — without the pressure of an agent.
          </p>
          <p style="color: #525252; line-height: 1.6;">
            👉 <a href="https://domuzz.com" style="color: #2563eb;">Visit domuzz.com</a> for more free tools including side-by-side house comparisons.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #525252; line-height: 1.6;">
            ☕ <strong>Keep these tools free.</strong> Your contribution helps us maintain and improve Domuzz for everyone — at no cost. Every coffee keeps us building.
          </p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="https://buymeacoffee.com/domuzzcom" 
               style="display: inline-block; background-color: #FFDD00; color: #000000; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              ☕ Buy me a coffee
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="font-size: 12px; color: #a3a3a3;">
            You're receiving this email because you downloaded a CMA report from Domuzz. 
            <br />If you'd like to unsubscribe, just reply to this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Resend welcome email error:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, address, reportData, consent } = body;

    if (!email || typeof email !== "string" || !validateEmail(email)) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "A property address is required." },
        { status: 400 }
      );
    }

    if (!consent) {
      return NextResponse.json(
        { error: "Consent is required to download the report." },
        { status: 400 }
      );
    }

    // Save lead to Neon (fire and forget)
    saveLead({ email, firstName, address, reportData });

    // Send welcome email (fire and forget, no PDF attachment)
    sendWelcomeEmail(email, firstName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}