import { SearchSelect } from "./SearchSelect";

type Option = { id: string; label: string };

/**
 * Pick a person (or family / place / clan …) by typing, not scrolling. Thin
 * wrapper over <SearchSelect> that keeps the old `{ id, label }` option shape
 * so every existing call site upgrades for free.
 */
export function PersonSelect({
  name,
  options,
  defaultValue,
  allowEmpty = true,
  emptyLabel = "— none —",
  required = false,
  multiple = false,
  allowCreate = false,
}: {
  name: string;
  options: Option[];
  defaultValue?: string | string[] | null;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  multiple?: boolean;
  /** show a "＋ Add …" row; submits `new:<name>` for the server to create */
  allowCreate?: boolean;
}) {
  return (
    <SearchSelect
      name={name}
      options={options.map((o) => ({ value: o.id, label: o.label }))}
      defaultValue={defaultValue}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      required={required}
      multiple={multiple}
      allowCreate={allowCreate}
      createLabel={(q) => `＋ Add “${q}” as a new person`}
      className="mt-1"
    />
  );
}
