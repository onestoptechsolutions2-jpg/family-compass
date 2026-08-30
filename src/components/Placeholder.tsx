export function Placeholder({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      <h2 className="font-medium">{title}</h2>
      <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        {children}
      </div>
    </div>
  );
}
