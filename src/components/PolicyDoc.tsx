export function PolicyDoc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-4">
      <h1 className="font-serif text-3xl">{title}</h1>
      {children}
    </article>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "var(--fg)" }}>{children}</p>;
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-4 text-lg font-semibold">{children}</h2>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="ml-5 list-disc space-y-1">{children}</ul>;
}
