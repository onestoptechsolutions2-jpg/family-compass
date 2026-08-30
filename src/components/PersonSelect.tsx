type Option = { id: string; label: string };

export function PersonSelect({
  name,
  options,
  defaultValue,
  allowEmpty = true,
  emptyLabel = "— none —",
}: {
  name: string;
  options: Option[];
  defaultValue?: string | null;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {allowEmpty && <option value="">{emptyLabel}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
