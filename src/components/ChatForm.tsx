"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { dayText, kenyaToday } from "@/lib/order-shared";

/**
 * The details step as a WhatsApp-style chat: we ask one thing at a time in a bubble, the answer
 * goes back as the customer's green bubble, and the typing bar sits at the bottom. Tap an answer
 * to change it; anything optional can be skipped. Everything is sent with the same form as before
 * (hidden fields, and the real file input for the photo), so saving works exactly as it did.
 */
export type ChatQuestion = {
  key: string;
  ask: string;
  hint?: string;
  placeholder?: string;
  kind: "text" | "long" | "photo" | "choice" | "date";
  choices?: [string, string][];
  required?: boolean;
  /** "year": the answer must carry a real year, e.g. "1948" or "2 October 2026" */
  check?: "year";
  /** the key of an earlier answer whose year this one cannot come before (death after birth) */
  notBefore?: string;
  /** a second way to answer: "I'll send it on WhatsApp", which sets `key` to `value` */
  later?: { label: string; key: string; value: string };
};

type Props = {
  intro: string;
  questions: ChatQuestion[];
  /** asked once the essentials are in: "add these too?" */
  more?: { ask: string; questions: ChatQuestion[] };
  initial: Record<string, string>;
  photoHref?: string;
  action: (formData: FormData) => void | Promise<void>;
};

const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const yearIn = (v: string) => Number(v.match(/\b(1[89]\d\d|20\d\d)\b/)?.[1] ?? NaN);
/** Why an answer cannot be taken, in a line the chat says back; null if it is fine. */
function problem(q: ChatQuestion, v: string, answers: Record<string, string>): string | null {
  if (!v || q.check !== "year") return null;
  const y = yearIn(v);
  if (!y) return "Please include the year, e.g. 1948 or 2 October 2026.";
  if (y > new Date().getFullYear()) return `${y} has not come yet. Please check the year.`;
  const before = q.notBefore ? yearIn(answers[q.notBefore] ?? "") : NaN;
  if (before && y < before) return `That is before they were born (${before}). Please check the year.`;
  return null;
}

/** Today and the next days in Kenya, as yyyy-mm-dd. */
const nextDays = (n: number) => {
  const today = new Date(`${kenyaToday()}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(today.getTime() + i * 86_400_000).toISOString().slice(0, 10));
};

export function ChatForm({ intro, questions, more, initial, photoHref, action }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [times, setTimes] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<string | undefined>(photoHref);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [wantMore, setWantMore] = useState<boolean | null>(more && more.questions.some((q) => initial[q.key]) ? true : null);
  // questions answered or skipped, in the order they were asked
  const [done, setDone] = useState<string[]>(() =>
    [...questions, ...(more?.questions ?? [])].filter((q) => initial[q.key] || (q.kind === "photo" && photoHref)).map((q) => q.key),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const flow = useMemo(() => [...questions, ...(wantMore ? (more?.questions ?? []) : [])], [questions, more, wantMore]);
  const current = editing ? flow.find((q) => q.key === editing) : flow.find((q) => !done.includes(q.key));
  const askMore = !current && more && wantMore === null;
  const finished = !current && !askMore;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [done.length, current?.key, askMore, finished]);

  const answer = (key: string, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setTimes((t) => ({ ...t, [key]: now() }));
    setDone((d) => (d.includes(key) ? d : [...d, key]));
    setEditing(null);
    setDraft("");
    setErr(null);
  };
  const send = () => {
    if (!current) return;
    const v = draft.trim();
    if (!v && current.required) return;
    const why = problem(current, v, answers);
    if (why) return setErr(why);
    answer(current.key, v);
  };
  const shown = (q: ChatQuestion) => {
    const v = answers[q.key] ?? "";
    if (q.kind === "choice") return q.choices?.find(([k]) => k === v)?.[1] ?? "Skipped";
    if (q.kind === "date") return v ? dayText(v) : "Skipped";
    if (!v && q.later && answers[q.later.key] === q.later.value) return q.later.label;
    return v || "Skipped";
  };
  const laterKeys = [...new Set([...questions, ...(more?.questions ?? [])].flatMap((q) => (q.later ? [q.later.key] : [])))];

  return (
    <form ref={formRef} action={action} className="flex flex-col">
      {/* what the form sends: every answer, the photo file, and whether to drop the old photo */}
      {[...questions, ...(more?.questions ?? [])].filter((q) => q.kind !== "photo").map((q) => (
        <input key={q.key} type="hidden" name={q.key} value={answers[q.key] ?? ""} />
      ))}
      {laterKeys.map((k) => <input key={k} type="hidden" name={k} value={answers[k] ?? ""} />)}
      {removePhoto && <input type="hidden" name="removePhoto" value="on" />}
      <input
        ref={fileRef}
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setPhoto(URL.createObjectURL(f));
          setRemovePhoto(false);
          answer("photoId", "added");
        }}
      />

      <div className="wa-chat -mx-4 flex min-h-[calc(100dvh-9rem)] flex-col gap-2 px-3 py-4 text-[15px]">
        <p className="wa-bubble-in">{intro}</p>
        {flow.filter((q) => done.includes(q.key) && q.key !== editing).map((q) => (
          <div key={q.key} className="flex flex-col gap-2">
            <p className="wa-bubble-in">{q.ask}</p>
            <button
              type="button"
              onClick={() => {
                setEditing(q.key);
                setDraft(answers[q.key] ?? "");
              }}
              className="wa-bubble-out text-left" aria-label={`Change: ${q.ask}`}>
              {q.kind === "photo" && photo && !removePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Their photo" className="h-40 w-32 rounded object-cover" />
              ) : (
                <span className="whitespace-pre-line">{q.kind === "photo" ? "No photo for now" : shown(q)}</span>
              )}
              <span className="wa-time">{times[q.key] ?? ""} ✓✓</span>
            </button>
          </div>
        ))}
        {current && (
          <p className="wa-bubble-in">
            {current.ask}
            {current.hint && <span className="mt-0.5 block text-xs" style={{ color: "#667781" }}>{current.hint}</span>}
          </p>
        )}
        {err && <p className="wa-bubble-in" role="alert">{err}</p>}
        {askMore && <p className="wa-bubble-in">{more!.ask}</p>}
        {finished && <p className="wa-bubble-in">That&apos;s all I need. Tap any answer to change it, or see how it looks.</p>}
        <div ref={endRef} />
      </div>

      {/* the typing bar */}
      <div className="wa-bar sticky bottom-0 -mx-4 flex flex-col gap-2 px-3 py-2">
        {current?.kind === "choice" && (
          <div className="flex flex-wrap gap-2">
            {current.choices!.map(([k, label]) => (
              <button key={k} type="button" className="wa-chip" aria-pressed={answers[current.key] === k} onClick={() => answer(current.key, k)}>{label}</button>
            ))}
          </div>
        )}
        {current?.kind === "date" && (
          <div className="flex flex-wrap gap-2">
            {nextDays(8).map((d, i) => (
              <button key={d} type="button" className="wa-chip" aria-pressed={answers[current.key] === d} onClick={() => answer(current.key, d)}>
                {i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayText(d, true)}
              </button>
            ))}
            <label className="wa-chip flex items-center gap-1">
              📅 Another day
              <input type="date" min={nextDays(1)[0]} className="bg-transparent text-sm" aria-label="Pick another day" onChange={(e) => e.target.value && answer(current.key, e.target.value)} />
            </label>
          </div>
        )}
        {current?.later && (
          <button
            type="button"
            className="wa-chip self-start"
            onClick={() => {
              setAnswers((a) => ({ ...a, [current.later!.key]: current.later!.value }));
              answer(current.key, "");
            }}
          >
            {current.later.label}
          </button>
        )}
        {current?.kind === "photo" && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wa-chip" onClick={() => fileRef.current?.click()}>📷 {photo && !removePhoto ? "Choose another photo" : "Add a photo"}</button>
            {photo && !removePhoto && (
              <button type="button" className="wa-chip" onClick={() => { setRemovePhoto(true); answer("photoId", ""); }}>Remove it</button>
            )}
            <button type="button" className="wa-chip" onClick={() => answer("photoId", answers.photoId ?? "")}>{photo && !removePhoto ? "Keep it" : "Skip"}</button>
          </div>
        )}
        {askMore && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="wa-chip" onClick={() => setWantMore(true)}>Yes, add them now</button>
            <button type="button" className="wa-chip" onClick={() => setWantMore(false)}>Later</button>
          </div>
        )}
        {current && (current.kind === "text" || current.kind === "long") && (
          <div className="flex items-end gap-2">
            {current.kind === "long" ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(Math.max(draft.split("\n").length, 2), 6)}
                placeholder={current.placeholder ?? "Type here"}
                aria-label={current.ask}
                className="min-w-0 flex-1 rounded-3xl border-0 bg-white px-4 py-3 text-base"
              />
            ) : (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={current.placeholder ?? "Type here"}
                aria-label={current.ask}
                autoFocus
                className="min-w-0 flex-1 rounded-full border-0 bg-white px-4 py-3 text-base"
              />
            )}
            <button type="button" onClick={send} className="wa-send" aria-label="Send" disabled={current.required && !draft.trim()}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden><path d="M2 21 23 12 2 3v7l15 2-15 2z" /></svg>
            </button>
          </div>
        )}
        {current && !current.required && current.kind !== "photo" && current.kind !== "choice" && !current.later && (
          <button type="button" onClick={() => answer(current.key, answers[current.key] ?? "")} className="self-start text-sm" style={{ color: "#667781" }}>Skip</button>
        )}
        {finished && (
          <button type="submit" className="w-full rounded-full bg-brand-600 px-5 py-3.5 text-base font-medium text-white hover:bg-brand-700">See how it looks</button>
        )}
      </div>
    </form>
  );
}
