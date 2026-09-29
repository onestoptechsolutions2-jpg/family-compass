import { SKILLS } from "@/lib/jobs";
import { requireUser } from "@/lib/rbac";
import { applyAsPartner } from "../actions";

export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-lg border px-3 py-2 text-sm";
const fieldStyle = { borderColor: "var(--border)", background: "var(--card)" } as const;

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  const { error } = await searchParams;
  return (
    <form action={applyAsPartner} className="flex flex-col gap-3 text-sm">
      <h1 className="text-lg font-semibold">Apply to become a partner</h1>
      {error && <p className="text-red-600">{error}</p>}
      <label>Business name<input name="name" required className={field} style={fieldStyle} /></label>
      <label>Phone or WhatsApp<input name="phone" className={field} style={fieldStyle} /></label>
      <label>Where you work (towns or counties, comma separated)<input name="regions" className={field} style={fieldStyle} /></label>
      <fieldset className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <legend className="px-1 font-medium">What you make</legend>
        <div className="flex flex-col gap-1">
          {Object.entries(SKILLS).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" name="skills" value={k} /> {label}</label>
          ))}
        </div>
      </fieldset>
      <label>Anything we should know (equipment, capacity, past work)<textarea name="notes" rows={3} className={field} style={fieldStyle} /></label>
      <button className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">Send application</button>
    </form>
  );
}
