import Link from "next/link";

import { Avatar } from "@/components/profile/Avatar";

export type Connection = {
  id: string;
  name: string;
  gender?: string;
  relation: string;
  detail?: string | null;
  href?: string;
  redacted?: boolean;
};

export function ConnectionGrid({ people }: { people: Connection[] }) {
  if (people.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No relatives recorded here yet.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {people.map((c) => {
        const inner = (
          <div
            className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
            style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}
          >
            <Avatar name={c.redacted ? "•" : c.name} gender={c.gender} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs" style={{ color: "var(--muted)" }}>
                {c.relation}
                {c.detail ? ` · ${c.detail}` : ""}
              </p>
            </div>
          </div>
        );
        return (
          <li key={c.id + c.relation}>
            {c.href && !c.redacted ? (
              <Link href={c.href} className="block hover:opacity-90">
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
