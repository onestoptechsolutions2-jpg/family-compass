import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { env } from "@/lib/env";
import { getSessionUser } from "@/lib/rbac";
import { searchDirectory } from "@/lib/discovery";
import { PeanutArt } from "@/components/GradientArt";
import { startCheck, startCreate, readStartDraft } from "./actions";

export const metadata: Metadata = {
  title: "Start your family tree",
  description: "Add yourself, then your parents and children. Free to build and share.",
};
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fs = { borderColor: "var(--border)", background: "var(--surface-2)" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 py-10">
      <Link href="/" className="text-lg font-semibold">🧭 Family Compass</Link>
      <div className="mt-8 flex-1">{children}</div>
      <footer className="mt-10 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        Free to build &amp; share. Living people are redacted on shared links.
      </footer>
    </main>
  );
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; err?: string }>;
}) {
  if (!env.SELF_START) redirect("/login");
  if (await getSessionUser()) redirect("/app");
  const { step, err } = await searchParams;

  // ---------- review / dedup ----------
  if (step === "review") {
    const d = await readStartDraft();
    if (!d) redirect("/start");

    const candidates = await searchDirectory({
      name: `${d.first} ${d.surname}`,
      community: d.community || undefined,
      region: d.region || undefined,
      birthYear: d.birthYear,
      window: 8,
    }).catch(() => []);
    const close = candidates
      .filter((c) => c.name.toLowerCase().includes(d.surname.toLowerCase()))
      .slice(0, 5);

    return (
      <Frame>
        <h1 className="font-serif text-2xl">
          {close.length ? "You might already be in a family tree" : "Looks new — let's set it up"}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Starting as <strong>{d.first} {d.surname}</strong>
          {d.birthYear ? `, born ${d.birthYear}` : ""}
          {d.community ? `, ${d.community}` : ""}.
        </p>

        {close.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {close.map((c) => (
              <li
                key={c.personId}
                className="rounded-xl border p-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="font-medium">{c.name}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                  {[c.treeName, c.clan && `${c.clan} clan`, c.community, c.birthYear && `b. ${c.birthYear}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {c.ownerWhatsapp && (
                  <a
                    href={`https://wa.me/${c.ownerWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                      `Hi — I think I'm in your "${c.treeName}" family tree (as ${c.name}). Could you add or link me?`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block rounded-md px-2.5 py-1 text-xs font-medium text-white"
                    style={{ background: "#25D366" }}
                  >
                    That&apos;s my family — message them
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <form action={startCreate}>
            <button className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
              {close.length ? "None of these are me — create my tree" : "Create my family tree"}
            </button>
          </form>
          <Link href="/start" className="rounded-full border px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
            ← Edit details
          </Link>
        </div>
      </Frame>
    );
  }

  // ---------- intro + form ----------
  const d = await readStartDraft();
  return (
    <Frame>
      <section className="relative overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <PeanutArt variant="hero" className="absolute inset-0 h-full w-full opacity-70" />
        <div className="relative px-6 py-10">
          <h1 className="font-serif text-2xl text-[#3b2a1c]">Start with yourself.</h1>
          <p className="mt-2 text-sm text-[#4a3728]">
            Add yourself, then your parents, then your children. Record your clan and where you come
            from. Free to build and share with relatives.
          </p>
        </div>
      </section>

      {err === "phone" && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>Enter a valid Safaricom / WhatsApp number.</p>
      )}

      <form action={startCheck} className="mt-5 flex flex-col gap-3 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Your first name</span>
            <input name="first" required defaultValue={d?.first} className={field} style={fs} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Surname</span>
            <input name="surname" required defaultValue={d?.surname} className={field} style={fs} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Sex</span>
            <select name="gender" defaultValue={d?.gender ?? "UNKNOWN"} className={field} style={fs}>
              <option value="UNKNOWN">prefer not to say</option>
              <option value="FEMALE">female</option>
              <option value="MALE">male</option>
              <option value="OTHER">other</option>
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Year of birth (optional)</span>
            <input name="birthYear" type="number" inputMode="numeric" defaultValue={d?.birthYear} className={field} style={fs} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Community / people (optional)</span>
            <input name="community" defaultValue={d?.community} placeholder="Bukusu, Luo, Kikuyu…" className={field} style={fs} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>County / area (optional)</span>
            <input name="region" defaultValue={d?.region} list="ke-loc" placeholder="Kakamega" className={field} style={fs} />
          </label>
        </div>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Your WhatsApp number</span>
          <input name="phone" required inputMode="tel" defaultValue={d?.phone} placeholder="07XX XXX XXX" className={field} style={fs} />
          <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
            Used to sign you in — no password, no email.
          </span>
        </label>
        <button className="self-start rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          Continue
        </button>
      </form>

      <p className="mt-4 text-xs" style={{ color: "var(--muted)" }}>
        Already have an account? <Link href="/login" className="hover:underline" style={{ color: "var(--link)" }}>Sign in</Link>.
        By continuing you accept the <Link href="/policies" className="hover:underline" style={{ color: "var(--link)" }}>policies</Link>.
      </p>
    </Frame>
  );
}
