import { Gender, Privacy } from "@prisma/client";

import { formatDate } from "@/lib/date";

type EventLike = {
  type: string;
  dateYear: number | null;
  dateMonth: number | null;
  dateDay: number | null;
  dateText: string | null;
  place: { title: string } | null;
} & Record<string, unknown>;

export type PersonFormValues = {
  first?: string | null;
  surname?: string | null;
  gender?: Gender;
  living?: boolean;
  privacy?: Privacy;
  clanId?: string | null;
  subClan?: string | null;
  events?: EventLike[];
};

function isoValue(e?: EventLike) {
  if (e?.dateYear && e.dateMonth && e.dateDay) {
    return `${String(e.dateYear).padStart(4, "0")}-${String(e.dateMonth).padStart(2, "0")}-${String(
      e.dateDay,
    ).padStart(2, "0")}`;
  }
  return "";
}

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--bg)" };

export function PersonForm({
  action,
  values,
  submitLabel,
  clans = [],
  locationHints = [],
}: {
  action: (formData: FormData) => void;
  clans?: { id: string; name: string }[];
  locationHints?: string[];
  values?: PersonFormValues;
  submitLabel: string;
}) {
  const birth = values?.events?.find((e) => e.type === "Birth");
  const death = values?.events?.find((e) => e.type === "Death");

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Given name(s)</span>
          <input name="first" defaultValue={values?.first ?? ""} className={field} style={fieldStyle} />
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Surname</span>
          <input name="surname" defaultValue={values?.surname ?? ""} className={field} style={fieldStyle} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Gender</span>
          <select name="gender" defaultValue={values?.gender ?? Gender.UNKNOWN} className={field} style={fieldStyle}>
            <option value={Gender.MALE}>Male</option>
            <option value={Gender.FEMALE}>Female</option>
            <option value={Gender.OTHER}>Other</option>
            <option value={Gender.UNKNOWN}>Unknown</option>
          </select>
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Privacy</span>
          <select name="privacy" defaultValue={values?.privacy ?? Privacy.INHERIT} className={field} style={fieldStyle}>
            <option value={Privacy.INHERIT}>Inherit from tree</option>
            <option value={Privacy.PUBLIC}>Public</option>
            <option value={Privacy.PRIVATE}>Private</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Clan</span>
          <select
            name="clanId"
            defaultValue={values?.clanId ?? ""}
            className={field}
            style={fieldStyle}
          >
            <option value="">— none —</option>
            {clans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span style={{ color: "var(--muted)" }}>Sub-clan / lineage</span>
          <input
            name="subClan"
            defaultValue={values?.subClan ?? ""}
            className={field}
            style={fieldStyle}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="living" value="true" defaultChecked={values?.living ?? false} />
        <span>Living person (details hidden on public shares)</span>
      </label>

      <fieldset className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <legend className="px-1 text-xs" style={{ color: "var(--muted)" }}>
          Birth
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Date</span>
            <input
              type="date"
              name="birthDate"
              defaultValue={isoValue(birth)}
              className={field}
              style={fieldStyle}
            />
            {birth && !isoValue(birth) && (
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                current: {formatDate(birth)}
              </span>
            )}
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Place</span>
            <input
              name="birthPlace" list="ke-loc"
              defaultValue={birth?.place?.title ?? ""}
              className={field}
              style={fieldStyle}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <legend className="px-1 text-xs" style={{ color: "var(--muted)" }}>
          Death
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Date</span>
            <input
              type="date"
              name="deathDate"
              defaultValue={isoValue(death)}
              className={field}
              style={fieldStyle}
            />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Place</span>
            <input
              name="deathPlace" list="ke-loc"
              defaultValue={death?.place?.title ?? ""}
              className={field}
              style={fieldStyle}
            />
          </label>
        </div>
      </fieldset>

      {locationHints.length > 0 && (
        <datalist id="ke-loc">
          {locationHints.map((h) => (
            <option key={h} value={h} />
          ))}
        </datalist>
      )}

      <div>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
