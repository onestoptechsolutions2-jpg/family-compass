import Link from "next/link";

import { displayName, initials, genderSymbol, genderColor } from "@/lib/person";
import type { Name } from "@prisma/client";

type PersonMini = {
  id: string;
  gender?: string;
  living?: boolean;
  /** true only when a Death/Burial event is recorded */
  deceased?: boolean;
  /** alternative to `deceased`: the Death/Burial eventRefs themselves */
  eventRefs?: { id: string }[];
  names: Pick<
    Name,
    "type" | "preferred" | "order" | "first" | "surname" | "surnamePrefix" | "nick" | "suffix" | "title"
  >[];
};

export function PersonChip({
  person,
  treeId,
}: {
  person: PersonMini | null | undefined;
  treeId: string;
}) {
  if (!person) return <span style={{ color: "var(--muted)" }}>Unknown</span>;
  const deceased = person.deceased ?? (person.eventRefs?.length ?? 0) > 0;
  return (
    <Link
      href={`/trees/${treeId}/people/${person.id}`}
      className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-sm hover:shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
        style={{ background: genderColor(person.gender) }}
      >
        {initials(person.names)}
      </span>
      {deceased && (
        <span aria-label="deceased" title="Deceased" style={{ color: "var(--muted)" }}>
          †
        </span>
      )}
      {genderSymbol(person.gender) && (
        <span aria-hidden title={person.gender?.toLowerCase()} style={{ color: genderColor(person.gender) }}>
          {genderSymbol(person.gender)}
        </span>
      )}
      {displayName(person.names)}
    </Link>
  );
}
