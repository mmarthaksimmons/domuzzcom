import { NextRequest, NextResponse } from "next/server";
import { CMAReportData } from "@/lib/cma";
import { renderToBuffer } from "@react-pdf/renderer";
import { Resend } from "resend";
import { CmaPdfDocument } from "@/lib/CmaPdfDocument";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function saveLead(data: {
  email: string;
  firstName: string | null;
  address: string;
  reportData: Record<string, unknown>;
  aiAnalysis: unknown;
  renovationData: unknown;
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
        reportData: {
          report: data.reportData,
          aiAnalysis: data.aiAnalysis ?? null,
          renovationData: data.renovationData ?? null,
        } as any,
        consent: true,
      },
    });
  } catch (dbError: unknown) {
    const err = dbError as { message?: string; code?: string };
    console.error("Prisma save error:", err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, firstName, address, reportData, consent, aiAnalysis, renovationData } = body;

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

    // Save lead (fire and forget)
    saveLead({ email, firstName, address, reportData, aiAnalysis, renovationData });

    // Generate PDF server-side for email
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "cma@domuzz.com";

    if (resendApiKey && resendApiKey !== "your_resend_api_key_here") {
      try {
        const pdfBuffer = await renderToBuffer(
          CmaPdfDocument({
            reportData: reportData as CMAReportData,
            aiAnalysis: (aiAnalysis as string) ?? null,
            renovationData: renovationData ?? null,
          })
        );
        const pdfUint8 = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
        const pdfBase64 = Buffer.from(pdfUint8).toString("base64");

        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: `Domuzz CMA Report <${fromEmail}>`,
          to: [email.trim().toLowerCase()],
          subject: `Your CMA Report for ${address}`,
          text: `Hi${firstName ? ` ${firstName}` : ""},\n\nYour free Comparative Market Analysis report for ${address} is attached to this email.\n\nThis report was generated using an automated valuation model (AVM) and public listing data. It is not a formal appraisal.\n\nTip: For a high-quality PDF with charts and maps, open the printable report from domuzz.com/cma and use your browser's "Save as PDF" option.\n\nThank you for using Domuzz!`,
          attachments: [
            {
              filename: `CMA-Report-${address.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
              content: pdfBase64,
              contentType: "application/pdf",
            },
          ],
        });
      } catch (err) {
        console.error("PDF/email error:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}