/**
 * Tiny, dependency-free User-Agent summariser. Good enough to tell one
 * device/browser apart from another in a "your sign-ins" list — not a full
 * UA database.
 */
export function describeDevice(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const s = ua;

  const browser =
    /\bEdg(?:A|iOS)?\//.test(s) ? "Edge" :
    /\bOPR\/|\bOpera\b/.test(s) ? "Opera" :
    /\bFirefox\/|\bFxiOS\//.test(s) ? "Firefox" :
    /\bChrome\/|\bCriOS\//.test(s) && !/\bEdg\//.test(s) ? "Chrome" :
    /\bSafari\//.test(s) && /\bVersion\//.test(s) ? "Safari" :
    /\bSamsungBrowser\//.test(s) ? "Samsung Internet" :
    /\bMSIE |\bTrident\//.test(s) ? "Internet Explorer" :
    null;

  const os =
    /\bWindows NT 10/.test(s) ? "Windows" :
    /\bWindows NT/.test(s) ? "Windows" :
    /\biPhone\b/.test(s) ? "iPhone" :
    /\biPad\b/.test(s) ? "iPad" :
    /\bAndroid\b/.test(s) ? "Android" :
    /\bMac OS X\b|\bMacintosh\b/.test(s) ? "macOS" :
    /\bCrOS\b/.test(s) ? "ChromeOS" :
    /\bLinux\b/.test(s) ? "Linux" :
    null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return s.slice(0, 60);
}

/** First hop of an X-Forwarded-For header, or null. */
export function clientIp(fwd: string | null | undefined): string | null {
  const first = fwd?.split(",")[0]?.trim();
  return first || null;
}
