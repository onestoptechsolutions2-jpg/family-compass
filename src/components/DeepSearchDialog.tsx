"use client";

import { useRef, useState, useTransition } from "react";

import { previewDeepSearch, startDeepSearch, type DeepSearchPreview } from "@/app/(app)/discover/actions";

type Prefill = {
  name?: string;
  clan?: string;
  community?: string;
  region?: string;
  birthYear?: string | number;
};

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const style = { borderColor: "var(--border)", background: "var(--bg)" } as const;

/**
 * Deep search as an overlay — invoked from wherever a cross-family lookup makes
 * sense (relationship check, a person page) rather than a page of its own. The
 * result is a teaser: given name + clan + era + area for each possible match,
 * with the full record and the family's contact behind one payment.
 */
export function DeepSearchDialog({
  label = "Deep search",
  buttonClass,
  prefill,
}: {
  label?: React.ReactNode;
  buttonClass?: string;
  prefill?: Prefill;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<DeepSearchPreview | null>(null);

  const open = () => {
    setRes(null);
    ref.current?.showModal();
  };
  const close = () => ref.current?.close();

  const submit = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    const raw: Prefill = {
      name: String(fd.get("name") ?? ""),
      clan: String(fd.get("clan") ?? ""),
      community: String(fd.get("community") ?? ""),
      region: String(fd.get("region") ?? ""),
      birthYear: String(fd.get("birthYear") ?? ""),
    };
    start(async () => setRes(await previewDeepSearch(raw)));
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={buttonClass ?? "rounded-lg border px-3 py-1.5 text-xs font-medium"}
        style={buttonClass ? undefined : { borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {label}
      </button>

      <dialog
        ref={ref}
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        style={{ maxWidth: "min(94vw, 40rem)" }}
      >
        <div
          className="flex items-center justify-between gap-4 border-b px-5 py-3.5"
          style={{ borderColor: "var(--hairline)" }}
        >
          <h3 className="font-serif text-lg leading-tight">Deep search across families</h3>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full text-sm"
            style={{ background: "var(--surface-2)", color: "var(--muted)" }}
          >
            ✕
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Check a name, clan or community against every family tree in the research directory —
            e.g. before a relationship or marriage. The preview shows who might match; unlock the
            full records and the families&apos; contacts to follow up.
          </p>

          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
          >
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Name</span>
              <input name="name" defaultValue={prefill?.name} className={field} style={style} />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Clan</span>
              <input name="clan" defaultValue={prefill?.clan} className={field} style={style} />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Community</span>
              <input
                name="community"
                defaultValue={prefill?.community}
                placeholder="Luhya, Kikuyu…"
                className={field}
                style={style}
              />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Region</span>
              <input name="region" defaultValue={prefill?.region} className={field} style={style} />
            </label>
            <label className="text-sm">
              <span style={{ color: "var(--muted)" }}>Approx. birth year</span>
              <input
                name="birthYear"
                type="number"
                defaultValue={prefill?.birthYear}
                className={field}
                style={style}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                disabled={pending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Searching…" : "Search"}
              </button>
            </div>
          </form>

          {res && !res.ok && (
            <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
              {res.error}
            </p>
          )}

          {res?.ok && (
            <div
              className="mt-4 rounded-xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <div className="text-2xl font-semibold">
                {res.count} possible match{res.count === 1 ? "" : "es"}
              </div>

              {res.count === 0 ? (
                <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                  Nobody matching is in the directory yet. Try fewer filters, or invite that family
                  to build their tree.
                </p>
              ) : (
                <>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {res.teasers.map((t, i) => (
                      <li
                        key={i}
                        className="rounded-lg border px-3 py-2 text-sm"
                        style={{ borderColor: "var(--hairline)", background: "var(--surface-2)" }}
                      >
                        <span className="font-medium">{t.label}</span>
                        <span style={{ color: "var(--muted)" }}>
                          {[
                            t.clan && `${t.clan} clan`,
                            t.bornDecade && `b. ${t.bornDecade}`,
                            t.place,
                            t.living ? "living" : null,
                          ]
                            .filter(Boolean)
                            .map((s) => ` · ${s}`)
                            .join("")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {res.count > res.teasers.length && (
                    <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      + {res.count - res.teasers.length} more not shown.
                    </p>
                  )}
                  <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                    Full names, which tree each is in, and the family&apos;s WhatsApp are unlocked
                    after payment.
                  </p>
                  <form action={startDeepSearch} className="mt-2">
                    {Object.entries(res.query).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                      Unlock full results — {res.currency} {res.priceKes.toLocaleString()}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
