"use client";

import { Dialog } from "@/components/Dialog";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fs = { borderColor: "var(--border)", background: "var(--bg)" };

function PersonFields({ surname }: { surname?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
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
        <input type="date" name="birthDate" className={field} style={fs} />
      </label>
      <label className="text-sm">
        <span style={{ color: "var(--muted)" }}>Born (place)</span>
        <input name="birthPlace" list="ke-loc" className={field} style={fs} />
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="living" value="true" defaultChecked /> Living
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
}: {
  role: "father" | "mother";
  action: (fd: FormData) => void;
  surname?: string | null;
}) {
  return (
    <Dialog label={`+ ${role}`} title={`Add a ${role}`}>
      <form action={action}>
        <input type="hidden" name="role" value={role} />
        <PersonFields surname={surname} />
        <Submit>Add {role}</Submit>
      </form>
    </Dialog>
  );
}

export function AddPartnerButton({
  action,
  buttonClass,
}: {
  action: (fd: FormData) => void;
  buttonClass?: string;
}) {
  return (
    <Dialog label="+ partner" title="Add a partner" buttonClass={buttonClass}>
      <form action={action}>
        <PersonFields />
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
            <input type="date" name="marriageDate" className={field} style={fs} />
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
}: {
  action: (fd: FormData) => void;
  back?: string;
}) {
  return (
    <Dialog label="+ child" title="Add a child">
      <form action={action}>
        {back && <input type="hidden" name="back" value={back} />}
        <PersonFields />
        <Submit>Add child</Submit>
      </form>
    </Dialog>
  );
}
