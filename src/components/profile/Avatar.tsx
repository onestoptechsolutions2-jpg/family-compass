import { MediaThumb } from "@/components/media/MediaThumb";

function tint(gender?: string): [string, string] {
  if (gender === "MALE") return ["var(--tree-male)", "#075765"];
  if (gender === "FEMALE") return ["#789a3c", "var(--tree-female)"];
  return ["#687789", "var(--tree-other)"];
}

export function Avatar({
  name,
  gender,
  mediaId,
  mimeType,
  share,
  size = 64,
  ring = false,
}: {
  name: string;
  gender?: string;
  mediaId?: string | null;
  mimeType?: string | null;
  share?: string;
  size?: number;
  ring?: boolean;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const [a, b] = tint(gender);
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: size * 0.36,
    background: `linear-gradient(135deg, ${a}, ${b})`,
    boxShadow: ring ? "0 0 0 4px var(--elevated)" : undefined,
  };

  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white"
      style={style}
    >
      {mediaId && mimeType?.startsWith("image/") ? (
        <MediaThumb mediaId={mediaId} mimeType={mimeType} alt={name} share={share} />
      ) : (
        initials
      )}
    </span>
  );
}
