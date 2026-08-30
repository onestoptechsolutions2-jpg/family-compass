"use client";

import { useId, useRef, useState, useTransition } from "react";

import { COMMON_OCCASIONS } from "@/lib/occasions";

export function UploadForm({
  action,
  name = "files",
  multiple = true,
  label = "Upload photos & documents",
  withOccasion = false,
}: {
  action: (formData: FormData) => Promise<void>;
  name?: string;
  multiple?: boolean;
  label?: string;
  withOccasion?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [occasion, setOccasion] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const submit = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append(name, f));
    if (occasion.trim()) fd.append("occasion", occasion.trim());
    setError(null);
    start(async () => {
      try {
        await action(fd);
        if (inputRef.current) inputRef.current.value = "";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    });
  };

  return (
    <div>
      {withOccasion && (
        <label className="mb-2 block text-sm">
          <span style={{ color: "var(--muted)" }}>Occasion / event (optional)</span>
          <input
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            list={listId}
            placeholder="e.g. wedding 1998, graduation, portrait"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <datalist id={listId}>
            {COMMON_OCCASIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
            Files are renamed with the person&apos;s name and this occasion, kept unique.
          </span>
        </label>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          submit(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 text-center text-sm"
        style={{
          borderColor: dragOver ? "var(--color-brand-600)" : "var(--border)",
          background: dragOver ? "var(--color-brand-50)" : "var(--card)",
        }}
      >
        <span className="font-medium">{pending ? "Uploading…" : label}</span>
        <span style={{ color: "var(--muted)" }}>
          Drag &amp; drop or click · JPG/PNG/WebP/GIF/PDF · up to 10 MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          multiple={multiple}
          accept="image/*,application/pdf,text/plain"
          hidden
          onChange={(e) => submit(e.target.files)}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
