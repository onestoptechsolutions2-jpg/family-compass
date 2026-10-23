import { env } from "@/lib/env";

/**
 * Whether the genealogy extras are offered (GENEALOGY_EXTRAS=true): research, the developer
 * API, the family directory, chama, deep search, friend invites and the family-energy score.
 * Off, the site leads with the shop and the family record; nothing is deleted.
 */
export const extrasEnabled = (): boolean => env.GENEALOGY_EXTRAS;
