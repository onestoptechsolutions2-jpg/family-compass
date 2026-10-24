"use client";

import { useState } from "react";

/**
 * A large, tappable place for the photo, which shows the picture as soon as it is chosen.
 * The file itself goes with the form, as `photo`; `removePhoto` takes a saved one away.
 */
export function PhotoPicker({ label, current }: { label: string; current?: string }) {
  const [shown, setShown] = useState<string | undefined>(current);
  const [removed, setRemoved] = useState(false);
  return (
    <div>
      <span className="text-sm font-medium">{label}</span>
      <label
        className="mt-1 flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed p-3"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        {shown && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="The photo you chose" className="h-24 w-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <span aria-hidden className="grid h-24 w-20 shrink-0 place-items-center rounded-lg text-3xl" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>+</span>
        )}
        <span className="text-sm">
          <span className="font-medium">{shown && !removed ? "Change photo" : "Add a photo"}</span>
          <span className="block text-xs" style={{ color: "var(--muted)" }}>From your phone&apos;s gallery or camera</span>
        </span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setShown(URL.createObjectURL(f));
              setRemoved(false);
            }
          }}
        />
      </label>
      {current && shown === current && !removed && (
        <button type="button" onClick={() => setRemoved(true)} className="mt-1 text-xs underline" style={{ color: "var(--muted)" }}>Remove photo</button>
      )}
      {removed && <input type="hidden" name="removePhoto" value="on" />}
    </div>
  );
}
