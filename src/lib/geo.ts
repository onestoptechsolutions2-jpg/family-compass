export type Geo = { lat?: number | null; lng?: number | null; url?: string | null };

const inRange = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Parse a pasted location: a "lat,lng" pair, or a Google/Apple Maps link
 * (pulls coordinates from @lat,lng / q=lat,lng / ll=lat,lng / !3dLAT!4dLNG).
 * Anything else is kept as a plain URL.
 */
export function parseGeo(raw: string | null | undefined): Geo {
  const s = (raw ?? "").trim();
  if (!s) return { lat: null, lng: null, url: null };

  // bare "lat, lng"
  const pair = /^(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (inRange(lat, lng)) return { lat, lng, url: null };
  }

  const isUrl = /^https?:\/\//i.test(s);
  if (isUrl) {
    const patterns = [
      /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/, // .../@lat,lng,zoom
      /[?&](?:q|ll|sll|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
      /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
      /\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    ];
    for (const re of patterns) {
      const m = re.exec(s);
      if (m) {
        const lat = Number(m[1]);
        const lng = Number(m[2]);
        if (inRange(lat, lng)) return { lat, lng, url: s };
      }
    }
    return { lat: null, lng: null, url: s };
  }

  return { lat: null, lng: null, url: null };
}

/** Best "open in maps" href for a location. */
export function mapsHref(g: Geo): string | null {
  if (g.lat != null && g.lng != null) return `https://www.google.com/maps?q=${g.lat},${g.lng}`;
  if (g.url) return g.url;
  return null;
}

export function geoLabel(g: Geo): string | null {
  if (g.lat != null && g.lng != null) return `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
  if (g.url) return "map link";
  return null;
}
