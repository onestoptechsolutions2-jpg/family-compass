export const FLOWER_KINDS = [
  { id: "flower", emoji: "🌹", label: "Lay a flower" },
  { id: "wreath", emoji: "💐", label: "Lay a wreath" },
  { id: "candle", emoji: "🕯️", label: "Light a candle" },
  { id: "heart", emoji: "🤍", label: "Leave love" },
] as const;

export type FlowerKind = (typeof FLOWER_KINDS)[number]["id"];

const BY_ID = new Map(FLOWER_KINDS.map((k) => [k.id, k]));

export function isFlowerKind(v: string): v is FlowerKind {
  return BY_ID.has(v as FlowerKind);
}

export function flowerEmoji(kind: string): string {
  return BY_ID.get(kind as FlowerKind)?.emoji ?? "🌹";
}
