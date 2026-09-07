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
  editHref,
}: {
  person: PersonMini | null | undefined;
  treeId: string;
  /** when set, shows a small "✎" link next to the chip — e.g. a quick way
   *  to update a spouse/parent/child's own details right from this page.
   *  Omit for viewers who can't edit that person. */
  editHref?: string;
}) {
  if (!person) return <span style={{ color: "var(--muted)" }}>Unknown</span>;
  const deceased = person.deceased ?? (person.eventRefs?.length ?? 0) > 0;
  return (
    <span className="inline-flex items-center gap-1">
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
      {editHref && (
        <Link
          href={editHref}
          title="Update their details"
          aria-label={`Update ${displayName(person.names)}'s details`}
          className="grid h-6 w-6 place-items-center rounded-full border text-xs hover:shadow-sm"
          style={{ borderColor: "var(--border)", background: "var(--card)" }}
        >
          ✎
        </Link>
      )}
    </span>
  );
}
