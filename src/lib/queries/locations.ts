import { db } from "@/lib/db";

/** Ward-level "County > Sub-county > Ward" strings for place autocomplete. */
export async function locationHints(): Promise<string[]> {
  const rows = await db.kenyaLocation.findMany({
    where: { ward: { not: null } },
    select: { path: true },
    orderBy: { path: "asc" },
    take: 1200,
  });
  return rows.map((r) => r.path);
}
