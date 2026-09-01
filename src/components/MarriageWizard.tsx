"use client";

import { Checklist } from "./Checklist";
import type { MarriageStep } from "@/lib/marriage-checklist";

export function MarriageWizard({
  familyId,
  label,
  steps,
}: {
  familyId: string;
  label: string;
  steps: MarriageStep[];
}) {
  return (
    <Checklist
      storageKey={`fc_marriage_hidden_${familyId}`}
      eyebrow="A new couple"
      title={`Finish ${label}'s record`}
      subtitle="A few things make this family unit complete"
      steps={steps}
      collapsedLabel={(d, t) => `Couple checklist (${d}/${t})`}
    />
  );
}
