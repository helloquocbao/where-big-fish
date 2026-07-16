/**
 * Utility functions for Google Analytics 4 (GA4) integration.
 */

let isAnalyticsInitialized = false;

/**
 * Injects the Google Tag script and initializes GA4 if VITE_GA_MEASUREMENT_ID
 * is configured in the environment variables.
 */
export function initAnalytics() {
  if (isAnalyticsInitialized) return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) {
    console.log("[Analytics] Measurement ID not configured. Skipping GA4 initialization.");
    return;
  }

  console.log("[Analytics] Initializing Google Analytics with ID:", measurementId);

  // Inject Google Tag Script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Setup window dataLayer and gtag function
  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(..._args: any[]) {
    (window as any).dataLayer.push(arguments);
  }
  (window as any).gtag = gtag;

  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: true,
  });

  isAnalyticsInitialized = true;
}

/**
 * Tracks a custom event in GA4.
 *
 * @param eventName Name of the event to track.
 * @param eventParams Optional parameters for the event.
 */
export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof (window as any).gtag === "function") {
    (window as any).gtag("event", eventName, eventParams);
  }
}
