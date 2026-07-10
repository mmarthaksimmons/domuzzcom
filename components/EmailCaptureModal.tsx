"use client";

import { useState, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CMAReportData } from "@/lib/cma";

interface EmailCaptureModalProps {
  open: boolean;
  onClose: () => void;
  address: string;
  reportData: CMAReportData;
  aiAnalysis?: string | null;
  renovationData?: {
    renovations: Record<string, number>;
    adjustedValue: number;
    addedValue: number;
    totalSpent: number;
  } | null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function EmailCaptureModal({
  open,
  onClose,
  address,
  reportData,
  aiAnalysis,
  renovationData,
}: EmailCaptureModalProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!consent) {
      setError("Please agree to receive occasional emails.");
      return;
    }

    setLoading(true);

    try {
      // Store report data in sessionStorage for the print page
      sessionStorage.setItem(
        "cma_print_data",
        JSON.stringify({
          reportData,
          aiAnalysis: aiAnalysis ?? null,
          renovationData: renovationData ?? null,
        })
      );

      // Send lead data to the server (email + save)
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || null,
          address,
          reportData,
          consent,
          aiAnalysis: aiAnalysis ?? null,
          renovationData: renovationData ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.warn("Lead save/email issue:", data.error);
        // Don't block — PDF download still works
      }

      // Open print page in new window
      window.open(
        "/cma/print",
        "_blank",
        "width=1100,height=800,scrollbars=yes"
      );

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl max-w-md w-full p-6">
        {!success ? (
          <>
            <h2 className="text-xl font-bold mb-1">Download Your CMA Report</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enter your email and we'll open a printable report. Save as
              PDF from your browser's print dialog.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name (optional)</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                  autoComplete="given-name"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                  disabled={loading}
                />
                <span className="text-xs text-muted-foreground">
                  I agree to receive occasional emails about selling my home. You
                  can unsubscribe at any time.
                </span>
              </label>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? "Opening..." : "Open Printable Report"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-xl font-bold mb-1">Report Opened!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              A print dialog should open in the new window. Select
              "Save as PDF" to download. We've also sent a copy
              to {email}.
            </p>
            <Button onClick={onClose} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}