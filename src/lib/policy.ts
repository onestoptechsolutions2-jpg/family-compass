/**
 * Bump POLICY_VERSION whenever the Terms / Privacy / Research policies change
 * in a way that needs fresh consent. Every signed-in user is re-prompted at
 * /consent until their User.consentVersion matches this.
 */
export const POLICY_VERSION = "2026-09";
export const POLICY_EFFECTIVE = "1 September 2026";

export const PROJECT_NAME = "Family Compass";
export const PROJECT_TAGLINE =
  "A community genealogy and family-history research project for Kenyan families, starting in Western Kenya.";

export const CONSENT_KIND = {
  policyAccept: "POLICY_ACCEPT",
  researchOptIn: "RESEARCH_OPT_IN",
  researchOptOut: "RESEARCH_OPT_OUT",
  marketingOptIn: "MARKETING_OPT_IN",
  marketingOptOut: "MARKETING_OPT_OUT",
} as const;
