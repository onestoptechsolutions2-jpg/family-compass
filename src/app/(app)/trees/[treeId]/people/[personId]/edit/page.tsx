import Link from "next/link";
import { notFound } from "next/navigation";

import { requireTreeEdit } from "@/lib/rbac";
import { getPersonDetail } from "@/lib/queries/people";
import { primaryName } from "@/lib/person";
import { PersonForm } from "@/components/PersonForm";
import { updatePerson } from "../../actions";

export const metadata = { title: "Edit person" };

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = await params;
  await requireTreeEdit(treeId);
  const person = await getPersonDetail(treeId, personId);
  if (!person) notFound();

  const name = primaryName(person.names);
  const action = updatePerson.bind(null, treeId, personId);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/trees/${treeId}/people/${personId}`}
        className="text-sm hover:underline"
        style={{ color: "var(--muted)" }}
      >
        ← Back to person
      </Link>
      <h2 className="text-lg font-semibold">Edit person</h2>
      <PersonForm
        action={action}
        submitLabel="Save changes"
        values={{
          first: name?.first,
          surname: name?.surname,
          gender: person.gender,
          living: person.living,
          privacy: person.privacy,
          events: person.eventRefs.map((r) => r.event),
        }}
      />
    </div>
  );
}
