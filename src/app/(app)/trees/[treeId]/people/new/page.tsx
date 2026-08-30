import Link from "next/link";

import { requireTreeEdit } from "@/lib/rbac";
import { db } from "@/lib/db";
import { locationHints } from "@/lib/queries/locations";
import { PersonForm } from "@/components/PersonForm";
import { createPerson } from "../actions";

export const metadata = { title: "Add person" };

export default async function NewPersonPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await requireTreeEdit(treeId);

  const [clans, hints] = await Promise.all([
    db.clan.findMany({ where: { treeId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    locationHints(),
  ]);
  const action = createPerson.bind(null, treeId);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/trees/${treeId}/people`}
        className="text-sm hover:underline"
        style={{ color: "var(--muted)" }}
      >
        ← People
      </Link>
      <h2 className="text-lg font-semibold">Add a person</h2>
      <PersonForm action={action} submitLabel="Create person" clans={clans} locationHints={hints} />
    </div>
  );
}
