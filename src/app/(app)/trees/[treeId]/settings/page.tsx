import { notFound } from "next/navigation";

import { loadTreeContext, canManageTree, canManageWorkspace } from "@/lib/rbac";
import { db } from "@/lib/db";
import { personOptions } from "@/lib/queries/people";
import { PersonSelect } from "@/components/PersonSelect";
import { Tabs } from "@/components/Tabs";
import { SearchSelect } from "@/components/SearchSelect";
import {
  renameTree,
  setHomePerson,
  setFamilyAdmin,
  updateDiscovery,
  updateLineage,
  backfillLineage,
  updateAnniversaryReminders,
  deleteTree,
} from "./actions";

export const metadata = { title: "Settings" };

export default async function TreeSettingsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) notFound();

  const treeBase = {
    name: true,
    description: true,
    homePersonId: true,
    adminUserId: true,
    discoverable: true,
    showcase: true,
    community: true,
    region: true,
    anniversaryReminders: true,
  } as const;
  // clanInheritance / inheritSurname land with migration …037 — tolerate a
  // database that hasn't caught up yet rather than 500 the settings page.
  const tree = await db.tree
    .findUniqueOrThrow({
      where: { id: treeId },
      select: { ...treeBase, clanInheritance: true, inheritSurname: true },
    })
    .catch(async () => {
      const b = await db.tree.findUniqueOrThrow({ where: { id: treeId }, select: treeBase });
      return { ...b, clanInheritance: "PATRILINEAL" as const, inheritSurname: true };
    });
  const options = await personOptions(treeId);
  const members = await db.membership.findMany({
    where: { workspaceId: ctx.workspace.id },
    select: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const memberOptions = members.map((m) => ({
    value: m.user.id,
    label: m.user.name || m.user.email,
  }));

  const general = (
    <>
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Tree details</h3>
        <form action={renameTree.bind(null, treeId)} className="mt-3 flex flex-col gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Name</span>
            <input
              name="name"
              defaultValue={tree.name}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Description</span>
            <textarea
              name="description"
              defaultValue={tree.description ?? ""}
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            />
          </label>
          <div>
            <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
              Save
            </button>
          </div>
        </form>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Home person</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          The default person tree views and shares are centered on.
        </p>
        <form action={setHomePerson.bind(null, treeId)} className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-sm">
            <PersonSelect name="homePersonId" options={options} defaultValue={tree.homePersonId} />
          </label>
          <button className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            Set
          </button>
        </form>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Family admin</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          The person responsible for this family&apos;s tree — approves claims, manages its shared
          links and sees its requests, even if their workspace role is lower.
        </p>
        <form action={setFamilyAdmin.bind(null, treeId)} className="mt-3 flex items-end gap-2">
          <label className="flex-1 text-sm">
            <SearchSelect
              name="adminUserId"
              options={memberOptions}
              defaultValue={tree.adminUserId}
              emptyLabel="— workspace owner —"
              placeholder="Search members…"
            />
          </label>
          <button className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
            Set
          </button>
        </form>
      </section>
    </>
  );

  const discovery = (
    <>
      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Research directory</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Let others find non-private people from this tree in a deep search (e.g. checking a
          bloodline before marriage). No full tree is exposed — just name, clan, community and
          approximate year, plus your WhatsApp for a connection request. See the{" "}
          <a href="/policies/research" target="_blank" className="text-brand-600 hover:underline">
            Research &amp; Ethics policy
          </a>
          .
        </p>
        <form action={updateDiscovery.bind(null, treeId)} className="mt-3 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="discoverable" value="true" defaultChecked={tree.discoverable} />
            List this tree in the research directory
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="showcase" value="true" defaultChecked={tree.showcase} />
            Also feature it in the public homepage carousel (aggregate counts only)
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Community</span>
              <input
                name="community"
                defaultValue={tree.community ?? ""}
                placeholder="Luhya, Kikuyu, Kamba, Kalenjin…"
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Region / county</span>
              <input
                name="region"
                defaultValue={tree.region ?? ""}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--bg)" }}
              />
            </label>
          </div>
          <div>
            <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
              Save
            </button>
          </div>
        </form>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Clan &amp; naming</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          When you add a child, they take their clan — and, if you like, their family name — from
          one parent by default. Most Kenyan communities reckon this through the father.
        </p>
        <form action={updateLineage.bind(null, treeId)} className="mt-3 flex flex-col gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Inherit clan from</span>
            <select
              name="clanInheritance"
              defaultValue={tree.clanInheritance}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm sm:w-64"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              <option value="PATRILINEAL">the father (patrilineal)</option>
              <option value="MATRILINEAL">the mother (matrilineal)</option>
              <option value="NONE">don&apos;t inherit automatically</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="inheritSurname" value="true" defaultChecked={tree.inheritSurname} />
            Also copy that parent&apos;s family name to a new child when it&apos;s left blank
          </label>
          <div>
            <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
              Save
            </button>
          </div>
        </form>
        <form action={backfillLineage.bind(null, treeId)} className="mt-3 border-t pt-3" style={{ borderColor: "var(--hairline)" }}>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Apply the rule to people already in the tree: fill a blank clan (and name) on every
            child from their lineage parent. Existing clans are left untouched.
          </p>
          <button className="mt-2 rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            Backfill clans from lineage
          </button>
        </form>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h3 className="font-medium">Anniversary reminders</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          A week before a birthday, or a death or wedding anniversary with a known day, notify tree
          editors and every relative who has claimed their profile.
        </p>
        <form action={updateAnniversaryReminders.bind(null, treeId)} className="mt-3">
          <input type="hidden" name="on" value={tree.anniversaryReminders ? "0" : "1"} />
          <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
            {tree.anniversaryReminders ? "Currently ON — turn off" : "Currently OFF — turn on"}
          </button>
        </form>
      </section>
    </>
  );

  const danger = (
    <section className="rounded-xl border p-4" style={{ borderColor: "#ef4444" }}>
      <h3 className="font-medium text-red-600">Danger zone</h3>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        Deleting a tree permanently removes all its people, families, media and shares.
      </p>
      <form action={deleteTree.bind(null, treeId)} className="mt-3">
        <button className="rounded-lg border border-red-500 px-3 py-1.5 text-sm text-red-600">
          Delete this tree
        </button>
      </form>
    </section>
  );

  return (
    <div className="max-w-xl">
      <Tabs
        items={[
          { id: "general", label: "General", panel: general },
          { id: "discovery", label: "Discovery & reminders", panel: discovery },
          ...(canManageWorkspace(ctx.role)
            ? [{ id: "danger", label: "Advanced", panel: danger }]
            : []),
        ]}
      />
    </div>
  );
}
