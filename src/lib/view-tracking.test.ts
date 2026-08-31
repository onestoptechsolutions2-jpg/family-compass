import { describe, expect, it } from "vitest";

import {
  isViewKind,
  regionFromTimezone,
  countryFromHeaders,
  deviceKind,
  referrerHost,
} from "./view-tracking";

describe("view-tracking", () => {
  it("isViewKind", () => {
    expect(isViewKind("memorial")).toBe(true);
    expect(isViewKind("share")).toBe(true);
    expect(isViewKind("nope")).toBe(false);
  });

  it("regionFromTimezone -> City · Continent", () => {
    expect(regionFromTimezone("Africa/Nairobi")).toBe("Nairobi · Africa");
    expect(regionFromTimezone("America/New_York")).toBe("New York · America");
    expect(regionFromTimezone("UTC")).toBe("UTC");
    expect(regionFromTimezone(null)).toBeNull();
  });

  it("countryFromHeaders reads proxy headers and rejects junk", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "ke" }))).toBe("KE");
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "US" }))).toBe("US");
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "XX" }))).toBeNull();
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "T1" }))).toBeNull();
    expect(countryFromHeaders(new Headers())).toBeNull();
  });

  it("deviceKind", () => {
    expect(deviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(deviceKind("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(deviceKind("WhatsApp/2.24")).toBe("bot");
    expect(deviceKind(null)).toBe("unknown");
  });

  it("referrerHost strips www and tolerates junk", () => {
    expect(referrerHost("https://www.google.com/search?q=x")).toBe("google.com");
    expect(referrerHost("https://t.co/abc")).toBe("t.co");
    expect(referrerHost("not a url")).toBeNull();
    expect(referrerHost(null)).toBeNull();
  });
});
