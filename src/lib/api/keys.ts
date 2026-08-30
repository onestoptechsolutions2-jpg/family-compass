import { createHash, randomBytes } from "node:crypto";

export type ApiScope = "read" | "write";
export const API_SCOPES: ApiScope[] = ["read", "write"];

const KEY_BYTES = 24; // 48 hex chars

export function generateApiKey(): { key: string; prefix: string; hashedKey: string } {
  const key = `fc_live_${randomBytes(KEY_BYTES).toString("hex")}`;
  return { key, prefix: key.slice(0, 16), hashedKey: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}
