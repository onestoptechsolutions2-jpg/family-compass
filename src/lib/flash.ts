import { cookies } from "next/headers";

import type { Flash, FlashType } from "@/lib/flash-types";

export type { Flash, FlashType } from "@/lib/flash-types";

const COOKIE = "fc_flash";
const TYPES: FlashType[] = ["success", "error", "info"];

/**
 * Queue a toast for the next page the user sees. Call from a Server Action or
 * route handler, before `redirect()` / `revalidatePath()`. Best-effort — never
 * throws. The cookie is intentionally not httpOnly so the <Toaster> can clear
 * it once shown; it only ever carries a short UI string.
 */
export async function setFlash(type: FlashType, message: string): Promise<void> {
  try {
    const jar = await cookies();
    const payload: Flash = {
      id: Math.random().toString(36).slice(2, 10),
      type,
      message: message.slice(0, 300),
    };
    jar.set(COOKIE, JSON.stringify(payload), {
      path: "/",
      maxAge: 30,
      sameSite: "lax",
    });
  } catch {
    /* cookies() not writable in this context — skip */
  }
}

export const flashOk = (m: string) => setFlash("success", m);
export const flashErr = (m: string) => setFlash("error", m);

/** Read the queued toast (no delete — the client clears it). Call from the
 *  app layout and pass the result to <Toaster>. */
export async function readFlash(): Promise<Flash | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Flash>;
    if (p && typeof p.id === "string" && typeof p.message === "string" && TYPES.includes(p.type as FlashType)) {
      return { id: p.id, type: p.type as FlashType, message: p.message };
    }
  } catch {
    /* malformed cookie — ignore */
  }
  return null;
}
