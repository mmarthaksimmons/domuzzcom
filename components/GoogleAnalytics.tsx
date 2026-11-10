"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Google Analytics 4 measurement ID.
 *
 * Intentionally required-if-set: there is **no** hard-coded fallback, so an
 * unset `NEXT_PUBLIC_GA_MEASUREMENT_ID` means the tag is never loaded. This
 * keeps forks and self-hosted instances from reporting into another
 * deployment's analytics property.
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface GoogleAnalyticsProps {
  /** GA4 measurement ID (e.g. "G-XXXXXXXXXX"). Overrides the env var. */
  measurementId?: string;
}

/**
 * Loads the Google tag (gtag.js) app-wide and reports client-side
 * navigations as `page_view` events so App Router transitions are tracked.
 * Renders nothing when no measurement ID is configured.
 */
export function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps = {}) {
  const pathname = usePathname();
  const lastPathname = useRef<string | null>(null);

  const gaMeasurementId =
    measurementId ?? process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!gaMeasurementId || !pathname) return;

    // gtag("config", ...) already sends the first page view on load,
    // so only subsequent client-side route changes are sent here.
    if (lastPathname.current === null) {
      lastPathname.current = pathname;
      return;
    }

    if (lastPathname.current === pathname) return;

    lastPathname.current = pathname;
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [gaMeasurementId, pathname]);

  if (!gaMeasurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${gaMeasurementId}');
        `}
      </Script>
    </>
  );
}
