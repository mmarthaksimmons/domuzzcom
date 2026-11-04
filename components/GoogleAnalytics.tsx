"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Google Analytics 4 measurement ID.
 * Falls back to the Domuzz property so the tag works out of the box.
 */
const DEFAULT_GA_MEASUREMENT_ID = "G-1GVF6NPP3K";
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || DEFAULT_GA_MEASUREMENT_ID;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

interface GoogleAnalyticsProps {
  /** GA4 measurement ID (e.g. "G-1GVF6NPP3K") */
  measurementId?: string;
}

/**
 * Loads the Google tag (gtag.js) app-wide and reports client-side
 * navigations as `page_view` events so App Router transitions are tracked.
 */
export function GoogleAnalytics({
  measurementId = GA_MEASUREMENT_ID,
}: GoogleAnalyticsProps) {
  const pathname = usePathname();
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

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
  }, [pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
