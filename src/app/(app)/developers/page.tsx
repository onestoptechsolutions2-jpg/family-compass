import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { personalWorkspaceId } from "@/lib/workspace";
import { db } from "@/lib/db";
import { EVENTS, EVENT_NAMES } from "@/lib/events-catalog";
import { CopyButton } from "@/components/CopyButton";
import {
  createApiKey,
  revokeApiKey,
  consumeNewKeyCookie,
  createWebhook,
  setWebhookActive,
  deleteWebhook,
  rotateWebhookSecret,
  sendTestEvent,
} from "./actions";

export const metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

const box = { borderColor: "var(--border)", background: "var(--card)" } as const;
const input = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const inStyle = { borderColor: "var(--border)", background: "var(--bg)" } as const;

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; hook?: string; err?: string }>;
}) {
  const user = await requireUser();
  const workspaceId = await personalWorkspaceId(user.id, user.name ?? user.email);
  const { created, err } = await searchParams;

  const [keys, hooks, newKey] = await Promise.all([
    db.apiKey.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true },
    }),
    db.webhookEndpoint.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, url: true, description: true, events: true, active: true, secret: true,
        failureCount: true, lastStatus: true, lastDeliveryAt: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, event: true, status: true, statusCode: true, attempts: true, createdAt: true, error: true },
        },
      },
    }),
    created ? consumeNewKeyCookie() : Promise.resolve(null),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Developers</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Integrate other applications with your workspace. Read the{" "}
          <Link href="/docs" className="text-brand-600 hover:underline">API &amp; webhook documentation</Link>.
        </p>
      </div>

      {newKey && (
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-brand-600)", background: "var(--card)" }}>
          <p className="text-sm font-medium">Your new API key — copy it now, it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{newKey}</code>
            <CopyButton value={newKey} />
          </div>
        </div>
      )}

      {/* ---- API keys ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">API keys</h2>
        <div className="rounded-xl border" style={box}>
          {keys.length === 0 && (
            <p className="p-4 text-sm" style={{ color: "var(--muted)" }}>No keys yet.</p>
          )}
          {keys.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-b p-3 text-sm last:border-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <div className="font-medium">
                  {k.name}
                  {k.revokedAt && <span className="ml-2 text-xs text-red-600">revoked</span>}
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  <code>{k.prefix}…</code> · {k.scopes.join(", ")} ·{" "}
                  {k.lastUsedAt ? `used ${k.lastUsedAt.toISOString().slice(0, 10)}` : "never used"}
                </div>
              </div>
              {!k.revokedAt && (
                <form action={revokeApiKey.bind(null, k.id)}>
                  <button className="rounded-md border px-2.5 py-1 text-xs text-red-600" style={{ borderColor: "var(--border)" }}>
                    Revoke
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <form action={createApiKey} className="rounded-xl border p-4" style={box}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Key name</span>
              <input name="name" placeholder="Zapier, internal ETL…" className={input} style={inStyle} />
            </label>
            <div className="flex items-end gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" name="scope_read" defaultChecked /> read</label>
              <label className="flex items-center gap-1"><input type="checkbox" name="scope_write" /> write</label>
            </div>
          </div>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Create key
          </button>
        </form>
      </section>

      {/* ---- Webhooks ---- */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Webhook endpoints</h2>
        {err === "url" && <p className="text-sm text-red-600">Enter a valid https URL.</p>}

        <div className="flex flex-col gap-3">
          {hooks.length === 0 && (
            <p className="rounded-xl border p-4 text-sm" style={{ ...box, color: "var(--muted)" }}>
              No endpoints. Add one below to receive event POSTs.
            </p>
          )}
          {hooks.map((h) => (
            <div key={h.id} className="rounded-xl border p-4 text-sm" style={box}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium break-all">{h.url}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>
                    {h.description ? `${h.description} · ` : ""}
                    {h.events.includes("*") ? "all events" : `${h.events.length} events`}
                    {" · "}
                    {h.active ? "active" : "disabled"}
                    {h.failureCount > 0 ? ` · ${h.failureCount} recent failures` : ""}
                    {h.lastStatus ? ` · last HTTP ${h.lastStatus}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <form action={sendTestEvent.bind(null, h.id)}>
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>Send test</button>
                  </form>
                  <form action={setWebhookActive.bind(null, h.id, !h.active)}>
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>
                      {h.active ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={rotateWebhookSecret.bind(null, h.id)}>
                    <button className="rounded-md border px-2 py-1 text-xs" style={{ borderColor: "var(--border)" }}>Rotate secret</button>
                  </form>
                  <form action={deleteWebhook.bind(null, h.id)}>
                    <button className="rounded-md border px-2 py-1 text-xs text-red-600" style={{ borderColor: "var(--border)" }}>Delete</button>
                  </form>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--muted)" }}>Signing secret</span>
                <code className="flex-1 overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{h.secret}</code>
                <CopyButton value={h.secret} />
              </div>

              {h.deliveries.length > 0 && (
                <ul className="mt-3 space-y-0.5 text-xs" style={{ color: "var(--muted)" }}>
                  {h.deliveries.map((d) => (
                    <li key={d.id}>
                      {d.createdAt.toISOString().slice(5, 16).replace("T", " ")} · {d.event} ·{" "}
                      <span style={{ color: d.status === "SUCCESS" ? "var(--color-brand-600)" : d.status === "FAILED" ? "#dc2626" : undefined }}>
                        {d.status}
                      </span>
                      {d.statusCode ? ` (${d.statusCode})` : ""}
                      {d.attempts > 1 ? ` ·${d.attempts} tries` : ""}
                      {d.error ? ` — ${d.error}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <form action={createWebhook} className="rounded-xl border p-4" style={box}>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Endpoint URL</span>
            <input name="url" required placeholder="https://example.com/hooks/family-compass" className={input} style={inStyle} />
          </label>
          <label className="mt-3 block text-sm">
            <span style={{ color: "var(--muted)" }}>Label (optional)</span>
            <input name="description" className={input} style={inStyle} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" name="allEvents" defaultChecked /> Subscribe to all events
          </label>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer" style={{ color: "var(--muted)" }}>Or pick specific events</summary>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {EVENT_NAMES.map((e) => (
                <label key={e} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" name={`ev_${e}`} /> <code>{e}</code>
                </label>
              ))}
            </div>
          </details>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Add endpoint
          </button>
        </form>

        <details className="text-xs" style={{ color: "var(--muted)" }}>
          <summary className="cursor-pointer">Event catalogue</summary>
          <ul className="mt-2 space-y-1">
            {EVENT_NAMES.map((e) => (
              <li key={e}><code>{e}</code> — {EVENTS[e]}</li>
            ))}
          </ul>
        </details>
      </section>
    </div>
  );
}
