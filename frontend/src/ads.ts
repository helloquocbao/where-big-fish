/**
 * Utility functions for Google AdSense banner integration.
 */

let isAdSenseInitialized = false;

/**
 * Injects the main Google AdSense script into the document head if
 * VITE_ADSENSE_CLIENT_ID is configured in the environment.
 */
export function initAdSense() {
  if (isAdSenseInitialized) return;

  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  if (!clientId) {
    console.log("[AdSense] Client ID not configured. Falling back to visual placeholders.");
    return;
  }

  console.log("[AdSense] Initializing Google AdSense with Client ID:", clientId);

  // Inject Google AdSense Script Tag
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);

  // Initialize the adsbygoogle array
  (window as any).adsbygoogle = (window as any).adsbygoogle || [];
  isAdSenseInitialized = true;
}

/**
 * Replaces the inner content of the target container with an AdSense `<ins>` tag
 * and triggers an ad request using `adsbygoogle.push({})`.
 *
 * @param containerId The HTML element ID where the ad will be placed.
 * @param slotId The AdSense slot ID.
 */
export function loadAdBanner(containerId: string, slotId: string | undefined) {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  if (!clientId || !slotId) {
    // If not configured, we leave the standard placeholder design untouched
    return;
  }

  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[AdSense] Container #${containerId} not found.`);
    return;
  }

  console.log(`[AdSense] Loading ad banner in #${containerId} (Slot: ${slotId})`);

  // Clear existing content and inject the AdSense ins tag
  container.innerHTML = `
    <ins class="adsbygoogle"
         style="display:inline-block;width:100%;height:100%"
         data-ad-client="${clientId}"
         data-ad-slot="${slotId}"
         data-full-width-responsive="false"></ins>
  `;

  try {
    ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
  } catch (e) {
    console.error(`[AdSense] Error requesting ad for slot ${slotId}:`, e);
  }
}
