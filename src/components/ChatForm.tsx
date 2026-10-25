"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  kind: "text" | "long" | "photo" | "choice";
  choices?: [string, string][];
  required?: boolean;
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
  };
  const send = () => {
    if (!current) return;
    const v = draft.trim();
    if (!v && current.required) return;
    answer(current.key, v);
  };
  const shown = (q: ChatQuestion) => {
    const v = answers[q.key] ?? "";
    if (q.kind === "choice") return q.choices?.find(([k]) => k === v)?.[1] ?? "Skipped";
    return v || "Skipped";
  };

  return (
    <form ref={formRef} action={action} className="flex flex-col">
      {/* what the form sends: every answer, the photo file, and whether to drop the old photo */}
      {[...questions, ...(more?.questions ?? [])].filter((q) => q.kind !== "photo").map((q) => (
        <input key={q.key} type="hidden" name={q.key} value={answers[q.key] ?? ""} />
      ))}
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
        {current && !current.required && current.kind !== "photo" && current.kind !== "choice" && (
          <button type="button" onClick={() => answer(current.key, answers[current.key] ?? "")} className="self-start text-sm" style={{ color: "#667781" }}>Skip</button>
        )}
        {finished && (
          <button type="submit" className="w-full rounded-full bg-brand-600 px-5 py-3.5 text-base font-medium text-white hover:bg-brand-700">See how it looks</button>
        )}
      </div>
    </form>
  );
}
