import Link from "next/link";

import { env } from "@/lib/env";
import { EVENTS, EVENT_NAMES } from "@/lib/events-catalog";
import { PeanutArt } from "@/components/GradientArt";

export const metadata = {
  title: "API & Webhooks — Family Compass",
  description: "REST API and signed webhooks for integrating other applications with Family Compass.",
};

const BASE = `${env.APP_URL}/api/v1`;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="mt-2 overflow-x-auto rounded-lg border p-3 text-xs leading-relaxed"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-10 scroll-mt-20 font-serif text-2xl">
      {children}
    </h2>
  );
}

const ENDPOINTS: { m: string; path: string; scope: string; desc: string }[] = [
  { m: "GET", path: "/ping", scope: "read", desc: "Verify a key; returns the workspace and granted scopes." },
  { m: "GET", path: "/trees", scope: "read", desc: "List trees in the workspace with people/family counts." },
  { m: "GET", path: "/trees/{treeId}", scope: "read", desc: "Tree summary and record counts." },
  { m: "GET", path: "/trees/{treeId}/people?limit&cursor&q", scope: "read", desc: "Paginated people. `q` filters by name. Living/private names are redacted." },
  { m: "GET", path: "/trees/{treeId}/people/{personId}", scope: "read", desc: "One person with parents and families." },
  { m: "POST", path: "/trees/{treeId}/people", scope: "write", desc: "Create a person (optionally with birth/death). Emits `person.created`." },
  { m: "GET", path: "/trees/{treeId}/families?limit&cursor", scope: "read", desc: "Paginated families with partner ids and child ids." },
  { m: "GET", path: "/trees/{treeId}/statistics", scope: "read", desc: "Aggregate statistics (totals, decades, surnames, clans)." },
  { m: "GET", path: "/trees/{treeId}/events?limit&cursor", scope: "read", desc: "Recent activity stream for the tree." },
];

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-lg font-semibold">🧭 Family Compass</Link>
      <PeanutArt variant="strip" className="mt-6 h-1.5 w-full rounded-full" />

      <h1 className="mt-8 font-serif text-3xl">API &amp; Webhooks</h1>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>
        Family Compass exposes a small REST API and outbound webhooks so you can sync a tree into
        another system, build dashboards, or react to family events. Create keys and endpoints in{" "}
        <Link href="/developers" className="text-brand-600 hover:underline">Developers</Link>.
      </p>

      <H id="auth">Authentication</H>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Every request needs a bearer API key. Keys are scoped to <strong>one workspace</strong> and
        carry <code>read</code> and/or <code>write</code> scope. The key is shown once at creation —
        store it securely. Only its SHA-256 is kept on our side.
      </p>
      <Code>{`curl ${BASE}/ping \\
  -H "Authorization: Bearer fc_live_xxxxxxxxxxxxxxxxxxxxxxxx"`}</Code>

      <H id="conventions">Conventions</H>
      <ul className="mt-2 ml-5 list-disc space-y-1 text-sm" style={{ color: "var(--muted)" }}>
        <li>Base URL: <code>{BASE}</code></li>
        <li>Success: <code>200/201</code> with <code>{`{ "data": ... }`}</code>.</li>
        <li>Error: <code>{`{ "error": { "code", "message" } }`}</code> with a <code>4xx/5xx</code> status.</li>
        <li>Pagination: pass <code>?limit=</code> (max 100) and <code>?cursor=</code>; the next cursor is returned in the <code>X-Next-Cursor</code> response header (empty when done).</li>
        <li>Rate limit: ~120 requests/minute per key; <code>429</code> with <code>Retry-After</code> when exceeded.</li>
        <li>CORS is open for GET, so read-only browser integrations work.</li>
      </ul>

      <H id="endpoints">Endpoints</H>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ color: "var(--muted)" }}>
              <th className="border-b py-1.5 pr-3 text-left" style={{ borderColor: "var(--border)" }}>Method</th>
              <th className="border-b py-1.5 pr-3 text-left" style={{ borderColor: "var(--border)" }}>Path</th>
              <th className="border-b py-1.5 pr-3 text-left" style={{ borderColor: "var(--border)" }}>Scope</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((e) => (
              <tr key={e.m + e.path} className="align-top">
                <td className="border-b py-2 pr-3 font-mono text-xs" style={{ borderColor: "var(--border)" }}>{e.m}</td>
                <td className="border-b py-2 pr-3" style={{ borderColor: "var(--border)" }}>
                  <code className="text-xs">{e.path}</code>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>{e.desc}</div>
                </td>
                <td className="border-b py-2 pr-3 text-xs" style={{ borderColor: "var(--border)" }}>{e.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Code>{`# create a person
curl -X POST ${BASE}/trees/TREE_ID/people \\
  -H "Authorization: Bearer fc_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"first":"Amina","surname":"Wanjiku","gender":"FEMALE","birthDate":"1990-04-12","birthPlace":"Kakamega"}'

# → 201 { "data": { "id": "...", "name": "Amina Wanjiku", "birth": { "year": 1990, ... } } }`}</Code>

      <H id="webhooks">Webhooks</H>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Register an HTTPS endpoint in <Link href="/developers" className="text-brand-600 hover:underline">Developers</Link>{" "}
        and subscribe to all events or a subset. When an event fires we POST a JSON body:
      </p>
      <Code>{`POST https://your-app.example.com/hooks
x-familycompass-event: person.created
x-familycompass-delivery: <delivery id>
x-familycompass-signature: sha256=<hex hmac of the raw body>

{
  "event": "person.created",
  "occurredAt": "2026-08-30T10:00:00.000Z",
  "workspaceId": "ws_...",
  "treeId": "tree_...",
  "data": { ... }
}`}</Code>
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
        Delivery: 10s timeout, retried with exponential backoff up to 6 times on non-2xx. After 15
        consecutive failures the endpoint is disabled and the workspace owner is notified. Recent
        deliveries and their status are visible in Developers.
      </p>

      <h3 className="mt-4 font-medium">Verifying the signature (Node)</h3>
      <Code>{`import crypto from "node:crypto";

function verify(rawBody, headerSig, secret) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerSig));
}`}</Code>

      <h3 className="mt-4 font-medium">Event catalogue</h3>
      <ul className="mt-2 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
        {EVENT_NAMES.map((e) => (
          <li key={e}>
            <code>{e}</code> — {EVENTS[e]}
          </li>
        ))}
      </ul>

      <H id="notes">Notes</H>
      <ul className="mt-2 ml-5 list-disc space-y-1 text-sm" style={{ color: "var(--muted)" }}>
        <li>Living-person and private-record redaction applies to API reads exactly as it does in shared views.</li>
        <li>Event names are stable and append-only. New fields may be added to <code>data</code> objects without notice — ignore unknown keys.</li>
        <li>This is v1. Breaking changes ship under <code>/api/v2</code>.</li>
      </ul>

      <p className="mt-10 text-sm" style={{ color: "var(--muted)" }}>
        <Link href="/developers" className="text-brand-600 hover:underline">Manage keys &amp; endpoints →</Link>
      </p>
    </main>
  );
}
