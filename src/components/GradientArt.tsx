/**
 * Lightweight generated SVG art in a warm "peanut" palette (roasted shell
 * browns + cream). Pure markup, renders on the server, no image files.
 *
 *  <PeanutArt variant="hero" />     full-bleed soft blobs for hero backdrops
 *  <PeanutArt variant="badge" />    a peanut silhouette medallion
 *  <PeanutArt variant="strip" />    thin gradient divider
 */
type Variant = "hero" | "badge" | "strip";

const PEANUT = {
  cream: "#F6ECDD",
  sand: "#E7CDA4",
  butter: "#D6A56B",
  roast: "#A9773F",
  shell: "#7A4E2D",
  cocoa: "#5B3A22",
};

export function PeanutArt({
  variant = "hero",
  className,
  seed = variant,
}: {
  variant?: Variant;
  className?: string;
  seed?: string;
}) {
  const uid = hash(seed);
  const g = (n: string) => `pa-${uid}-${n}`;

  if (variant === "strip") {
    return (
      <svg className={className} viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden role="presentation">
        <defs>
          <linearGradient id={g("s")} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={PEANUT.sand} />
            <stop offset="0.5" stopColor={PEANUT.butter} />
            <stop offset="1" stopColor={PEANUT.roast} />
          </linearGradient>
        </defs>
        <rect width="1200" height="40" fill={`url(#${g("s")})`} />
      </svg>
    );
  }

  if (variant === "badge") {
    return (
      <svg className={className} viewBox="0 0 160 160" aria-hidden role="presentation">
        <defs>
          <radialGradient id={g("b")} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor={PEANUT.cream} />
            <stop offset="0.45" stopColor={PEANUT.butter} />
            <stop offset="1" stopColor={PEANUT.shell} />
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="76" fill={`url(#${g("b")})`} />
        {/* peanut silhouette: two lobes joined by a waist */}
        <path
          d="M80 34c14 0 24 10 24 22 0 7-3 12-3 18 0 7 5 12 5 20 0 15-12 26-27 26s-27-11-27-25c0-8 5-13 5-20 0-6-3-11-3-18 0-13 11-23 23-23z"
          fill={PEANUT.cocoa}
          opacity="0.82"
        />
        <ellipse cx="72" cy="62" rx="6" ry="7" fill={PEANUT.cream} opacity="0.5" />
      </svg>
    );
  }

  // hero
  return (
    <svg
      className={className}
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      role="presentation"
    >
      <defs>
        <linearGradient id={g("bg")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={PEANUT.cream} />
          <stop offset="1" stopColor={PEANUT.sand} />
        </linearGradient>
        <radialGradient id={g("a")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={PEANUT.butter} />
          <stop offset="1" stopColor={PEANUT.butter} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("c")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={PEANUT.roast} />
          <stop offset="1" stopColor={PEANUT.roast} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={g("d")} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={PEANUT.shell} />
          <stop offset="1" stopColor={PEANUT.shell} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="600" height="400" fill={`url(#${g("bg")})`} />
      <circle cx={90 + (uid % 40)} cy={110} r={190} fill={`url(#${g("a")})`} />
      <circle cx={470 - (uid % 30)} cy={70} r={150} fill={`url(#${g("c")})`} />
      <circle cx={420} cy={360} r={200} fill={`url(#${g("d")})`} />
    </svg>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 1000;
}
