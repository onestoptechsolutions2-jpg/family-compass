export type ClaimGuardInput = {
  /** set when a user account already owns this profile */
  claimedByUserId?: string | null;
  /** true when a Death or Burial event is recorded */
  deceased?: boolean;
  /** name as shown in a redacted shared graph, e.g. "Living Omondi" */
  redactedName?: string | null;
};

/**
 * Single source of truth for "may this profile still be offered for someone
 * to claim as themselves?". A deceased person is never claimable — their
 * profile is a memorial — and recording a death releases any existing claim.
 */
export function isProfileClaimable(p: ClaimGuardInput): boolean {
  if (p.claimedByUserId) return false;
  if (p.deceased) return false;
  if (p.redactedName && p.redactedName.startsWith("Living ")) return false;
  return true;
}
