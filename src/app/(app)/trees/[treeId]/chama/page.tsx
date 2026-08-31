import { notFound } from "next/navigation";

import { loadTreeContext, canManageTree } from "@/lib/rbac";
import { db } from "@/lib/db";
import { publicOrigin } from "@/lib/origin";
import { fetchCapitalPosition, fetchRecentContributions } from "@/lib/chama-api";
import { CopyButton } from "@/components/CopyButton";
import { linkChama, refreshChama, unlinkChama, setChamaPushWelfare } from "./actions";

export const metadata = { title: "Chama" };

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";

export default async function ChamaPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const { treeId } = await params;
  const { ok, err } = await searchParams;
  const ctx = await loadTreeContext(treeId);
  if (!canManageTree(ctx.role)) notFound();

  const link = await db.chamaLink.findUnique({ where: { treeId } });
  const style = { borderColor: "var(--border)", background: "var(--bg)" };
  const card = { borderColor: "var(--border)", background: "var(--card)" };

  const [position, recent] = link
    ? await Promise.all([fetchCapitalPosition(link), fetchRecentContributions(link)])
    : [null, [] as Record<string, unknown>[]];

  const webhookUrl = link ? `${await publicOrigin()}/api/webhooks/chama/${treeId}` : null;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Chama</h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Link this family tree to a group on the Chama platform. Confirmed welfare-fund
          contributions on memorials are then also recorded on that group.
        </p>
      </div>

      {ok === "linked" && <p className="rounded-lg border p-3 text-sm text-green-700" style={{ borderColor: "var(--border)" }}>Group linked.</p>}
      {ok === "unlinked" && <p className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Group unlinked.</p>}
      {err === "key" && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>That doesn&apos;t look like a Chama API key (starts with <code>chama_live_</code>).</p>}
      {err === "validate" && <p className="rounded-lg border p-3 text-sm text-red-600" style={{ borderColor: "var(--border)" }}>Couldn&apos;t validate the key against the group API. Check the key and base URL.</p>}

      {!link ? (
        <form action={linkChama.bind(null, treeId)} className="rounded-xl border p-4" style={card}>
          <h2 className="font-medium">Link a group</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            In the Chama dashboard, open <strong>Developer</strong> and create an API key for the
            group, then paste it here. The key needs read access plus &ldquo;record contribution&rdquo;.
          </p>
          <label className="mt-3 block text-sm">
            <span style={{ color: "var(--muted)" }}>API key</span>
            <input name="apiKey" required placeholder="chama_live_…" className={field} style={style} />
          </label>
          <label className="mt-2 block text-sm">
            <span style={{ color: "var(--muted)" }}>Base URL</span>
            <input name="baseUrl" defaultValue="https://chama.laitor.co.ke" className={field} style={style} />
          </label>
          <button className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Link group
          </button>
        </form>
      ) : (
        <>
          <div className="rounded-xl border p-4" style={card}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">{link.groupName ?? "Chama group"}</h2>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {link.groupType || "group"} · {link.currency} · group #{link.groupId ?? "?"}
                  {link.lastSyncedAt ? ` · synced ${link.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ")}` : ""}
                </p>
              </div>
              <form action={refreshChama.bind(null, treeId)}>
                <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>Refresh</button>
              </form>
            </div>
            {link.lastError && (
              <p className="mt-2 rounded-lg border p-2 text-xs text-red-600" style={{ borderColor: "var(--border)" }}>{link.lastError}</p>
            )}

            <form action={setChamaPushWelfare.bind(null, treeId)} className="mt-3">
              <input type="hidden" name="on" value={link.pushWelfare ? "0" : "1"} />
              <button className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)" }}>
                {link.pushWelfare ? "Push welfare contributions: ON — turn off" : "Push welfare contributions: OFF — turn on"}
              </button>
            </form>

            <form action={unlinkChama.bind(null, treeId)} className="mt-2">
              <button className="text-xs text-red-600 hover:underline">Unlink this group</button>
            </form>
          </div>

          {position && (
            <div className="rounded-xl border p-4 text-sm" style={card}>
              <h2 className="font-medium">Capital position</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(position).map(([k, v]) => (
                  <li key={k}>
                    <span style={{ color: "var(--muted)" }}>{k}</span>
                    <div className="font-medium">{typeof v === "number" ? v.toLocaleString("en-KE") : String(v)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recent.length > 0 && (
            <div className="rounded-xl border p-4 text-sm" style={card}>
              <h2 className="font-medium">Recent contributions on the group</h2>
              <ul className="mt-2 flex flex-col">
                {recent.slice(0, 15).map((c, i) => (
                  <li key={i} className="flex items-center justify-between border-b py-1.5 last:border-0" style={{ borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--muted)" }}>{String(c.type ?? "")}</span>
                    <span className="font-medium">{Number(c.amount ?? 0).toLocaleString("en-KE")}</span>
                    <span style={{ color: "var(--muted)" }}>{String(c.status ?? "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {webhookUrl && (
            <div className="rounded-xl border p-4 text-sm" style={card}>
              <h2 className="font-medium">Inbound webhook</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                In the Chama dashboard → Developer, subscribe this URL and paste the signing secret
                below matches what we stored. We verify <code>X-Chama-Signature</code> (HMAC-SHA256).
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="max-w-full overflow-x-auto rounded bg-black/5 px-2 py-1 text-xs">{webhookUrl}</code>
                <CopyButton value={webhookUrl} label="Copy URL" />
              </div>
              {link.webhookSecret && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-black/5 px-2 py-1 text-xs">{link.webhookSecret}</code>
                  <CopyButton value={link.webhookSecret} label="Copy secret" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
