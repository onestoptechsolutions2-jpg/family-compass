import Link from "next/link";

import { displayName, initials } from "@/lib/person";
import type { Name } from "@prisma/client";

type PersonMini = {
  id: string;
  gender?: string;
  living?: boolean;
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
  return (
    <Link
      href={`/trees/${treeId}/people/${person.id}`}
      className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-sm hover:shadow-sm"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold"
        style={{ background: "var(--color-brand-100)", color: "var(--color-brand-700)" }}
      >
        {initials(person.names)}
      </span>
      {displayName(person.names)}
    </Link>
  );
}
