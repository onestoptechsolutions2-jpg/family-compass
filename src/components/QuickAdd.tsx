"use client";

import { Dialog } from "@/components/Dialog";
import { SearchSelect } from "@/components/SearchSelect";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fs = { borderColor: "var(--border)", background: "var(--bg)" };

export type PickOption = { id: string; label: string };

function PersonFields({
  surname,
  people = [],
}: {
  surname?: string | null;
  people?: PickOption[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {people.length > 0 && (
        <label className="col-span-2 text-sm">
          <span style={{ color: "var(--muted)" }}>Link a person already in the tree</span>
          <SearchSelect
            name="existingId"
            options={people.map((p) => ({ value: p.id, label: p.label }))}
            emptyLabel="— or create a new person below —"
            placeholder="Search people in the tree…"
            className="mt-1"
          />
        </label>
      )}
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Given name(s)</span>
        <input name="first" className={field} style={fs} autoFocus />
      </label>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Surname</span>
        <input name="surname" defaultValue={surname ?? ""} className={field} style={fs} />
      </label>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Born (date)</span>
        <input
          name="birthDate"
          placeholder="1948 · Mar 1948 · 12 Mar 1948 · about 1950"
          className={field}
          style={fs}
        />
      </label>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Born (place)</span>
        <input name="birthPlace" list="ke-loc" className={field} style={fs} />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="living" value="true" defaultChecked /> Living
      </label>
      <label className="col-span-2 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
        <input type="checkbox" name="allowDup" value="1" /> Add even if someone with this name already exists
      </label>
    </div>
  );
}

function Submit({ children }: { children: React.ReactNode }) {
  return (
    <button className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
      {children}
    </button>
  );
}

export function AddParentButton({
  role,
  action,
  surname,
  people,
}: {
  role: "father" | "mother";
  action: (fd: FormData) => void;
  surname?: string | null;
  people?: PickOption[];
}) {
  return (
    <Dialog label={`+ ${role}`} title={`Add a ${role}`}>
      <form action={action}>
        <input type="hidden" name="role" value={role} />
        <PersonFields surname={surname} people={people} />
        <Submit>Add {role}</Submit>
      </form>
    </Dialog>
  );
}

export function AddPartnerButton({
  action,
  buttonClass,
  people,
}: {
  action: (fd: FormData) => void;
  buttonClass?: string;
  people?: PickOption[];
}) {
  return (
    <Dialog label="+ partner" title="Add a partner" buttonClass={buttonClass}>
      <form action={action}>
        <PersonFields people={people} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Relationship</span>
            <select name="type" className={field} style={fs} defaultValue="MARRIED">
              <option value="MARRIED">married</option>
              <option value="UNMARRIED">unmarried</option>
              <option value="CIVIL_UNION">civil union</option>
              <option value="UNKNOWN">unknown</option>
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Gender</span>
            <select name="gender" className={field} style={fs} defaultValue="UNKNOWN">
              <option value="FEMALE">female</option>
              <option value="MALE">male</option>
              <option value="OTHER">other</option>
              <option value="UNKNOWN">unknown</option>
            </select>
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Married (date)</span>
            <input name="marriageDate" placeholder="1972 · Jun 1972 · about 1970" className={field} style={fs} />
          </label>
          <label className="text-sm">
            <span style={{ color: "var(--muted)" }}>Married (place)</span>
            <input name="marriagePlace" list="ke-loc" className={field} style={fs} />
          </label>
        </div>
        <Submit>Add partner</Submit>
      </form>
    </Dialog>
  );
}

export function AddChildButton({
  action,
  back,
  people,
}: {
  action: (fd: FormData) => void;
  back?: string;
  people?: PickOption[];
}) {
  return (
    <Dialog label="+ child" title="Add a child">
      <form action={action}>
        {back && <input type="hidden" name="back" value={back} />}
        <PersonFields people={people} />
        <label className="mt-2 block text-sm">
          <span style={{ color: "var(--muted)" }}>Relationship to parents</span>
          <select name="childRelation" defaultValue="BIRTH" className={field} style={fs}>
            <option value="BIRTH">birth</option>
            <option value="ADOPTED">adopted</option>
            <option value="STEPCHILD">stepchild</option>
            <option value="FOSTER">foster</option>
            <option value="SPONSORED">sponsored / guardian</option>
            <option value="UNKNOWN">unknown</option>
          </select>
        </label>
        <Submit>Add child</Submit>
      </form>
    </Dialog>
  );
}
