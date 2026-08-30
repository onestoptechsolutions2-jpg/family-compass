import { describe, expect, it } from "vitest";

import { parseGeo, mapsHref, geoLabel } from "./geo";

describe("parseGeo", () => {
  it("parses a bare lat,lng pair", () => {
    expect(parseGeo("-1.28640, 36.81724")).toMatchObject({ lat: -1.2864, lng: 36.81724, url: null });
    expect(parseGeo("1.5 35.2")).toMatchObject({ lat: 1.5, lng: 35.2 });
  });

  it("rejects out-of-range pairs", () => {
    expect(parseGeo("200, 12")).toMatchObject({ lat: null, lng: null });
  });

  it("pulls coordinates from a Google Maps @lat,lng link", () => {
    const g = parseGeo("https://www.google.com/maps/@-1.2921,36.8219,15z");
    expect(g.lat).toBeCloseTo(-1.2921);
    expect(g.lng).toBeCloseTo(36.8219);
    expect(g.url).toContain("google.com");
  });

  it("pulls coordinates from a ?q= link and a !3d!4d link", () => {
    expect(parseGeo("https://maps.google.com/?q=-1.30,36.80").lat).toBeCloseTo(-1.3);
    expect(parseGeo("https://x/maps/place/foo/@0,0/data=!3d-1.11!4d36.22").lng).toBeCloseTo(36.22);
  });

  it("keeps an unrecognised URL as url-only", () => {
    const g = parseGeo("https://maps.app.goo.gl/abc123");
    expect(g).toMatchObject({ lat: null, lng: null });
    expect(g.url).toBe("https://maps.app.goo.gl/abc123");
  });

  it("returns empty for junk and blanks", () => {
    expect(parseGeo("")).toMatchObject({ lat: null, lng: null, url: null });
    expect(parseGeo("Nairobi CBD")).toMatchObject({ lat: null, lng: null, url: null });
  });
});

describe("mapsHref / geoLabel", () => {
  it("prefers coordinates, then url", () => {
    expect(mapsHref({ lat: -1.2, lng: 36.8 })).toBe("https://www.google.com/maps?q=-1.2,36.8");
    expect(mapsHref({ url: "https://example.com/x" })).toBe("https://example.com/x");
    expect(mapsHref({})).toBeNull();
  });
  it("labels coordinates and links", () => {
    expect(geoLabel({ lat: -1.234567, lng: 36.111111 })).toBe("-1.23457, 36.11111");
    expect(geoLabel({ url: "https://x" })).toBe("map link");
    expect(geoLabel({})).toBeNull();
  });
});
