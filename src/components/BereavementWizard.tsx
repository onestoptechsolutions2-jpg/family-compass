"use client";

import { Checklist } from "./Checklist";
import type { BereaveStep } from "@/lib/bereavement";

export function BereavementWizard({
  personId,
  name,
  steps,
}: {
  personId: string;
  name: string;
  steps: BereaveStep[];
}) {
  return (
    <Checklist
      storageKey={`fc_bereave_hidden_${personId}`}
      eyebrow="After a death"
      title={`Arranging things for ${name}`}
      subtitle="Take these in your own time. Recording the burial here also puts it on the family tree"
      steps={steps}
      collapsedLabel={(d, t) => `Funeral checklist (${d}/${t})`}
    />
  );
}
