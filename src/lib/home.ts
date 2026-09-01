import { db } from "@/lib/db";

/**
 * A claimed account's home is **their own profile, centred on them**. This is
 * the single source of truth for "where does this sign-in land". Anyone who
 * hasn't claimed a profile lands on the workspace list (`/app`).
 *
 * Use it from every post-auth redirect (WhatsApp link, magic link, "Open
 * app") so a relative who claimed their node always starts as themselves.
 */
export async function homePathForUser(
  userId: string,
  opts: { welcome?: boolean } = {},
): Promise<string> {
  const me = await db.person.findFirst({
    where: { claimedByUserId: userId },
    select: { id: true, treeId: true },
  });
  if (!me) return "/app";
  return `/trees/${me.treeId}/people/${me.id}${opts.welcome ? "?welcome=1" : ""}`;
}
