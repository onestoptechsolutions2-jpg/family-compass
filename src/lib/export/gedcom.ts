import { DateModifier } from "@prisma/client";

import type { ExportData, ExportEvent } from "./load";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function part(y: number | null, m: number | null, d: number | null): string {
  if (!y) return "";
  const bits: string[] = [];
  if (d && m) bits.push(String(d));
  if (m) bits.push(MONTHS[m - 1] ?? "");
  bits.push(String(y));
  return bits.filter(Boolean).join(" ");
}

export function gedcomDate(e: ExportEvent): string {
  const a = part(e.dateYear, e.dateMonth, e.dateDay);
  const b = part(e.dateYear2, e.dateMonth2, e.dateDay2);
  switch (e.dateModifier) {
    case DateModifier.EXACT:
      return a;
    case DateModifier.ABOUT:
      return a ? `ABT ${a}` : "";
    case DateModifier.BEFORE:
      return a ? `BEF ${a}` : "";
    case DateModifier.AFTER:
      return a ? `AFT ${a}` : "";
    case DateModifier.RANGE:
      return a && b ? `BET ${a} AND ${b}` : a || b;
    case DateModifier.SPAN:
      return a && b ? `FROM ${a} TO ${b}` : a || b;
    default:
      return e.dateText ? `(${e.dateText})` : "";
  }
}

const GED_TAG: Record<string, string> = {
  Birth: "BIRT",
  Death: "DEAT",
  Burial: "BURI",
  Cremation: "CREM",
  Baptism: "BAPM",
  Christening: "CHR",
  Marriage: "MARR",
  Divorce: "DIV",
  Engagement: "ENGA",
  Residence: "RESI",
  Occupation: "OCCU",
  Education: "EDUC",
};

export function toGedcom(data: ExportData): string {
  const lines: string[] = [];
  const w = (level: number, tag: string, value?: string) =>
    lines.push(value ? `${level} ${tag} ${value}` : `${level} ${tag}`);

  const iId = new Map(data.people.map((p, i) => [p.id, `@I${i + 1}@`]));
  const fId = new Map(data.families.map((f, i) => [f.id, `@F${i + 1}@`]));
  const placeById = new Map(data.places.map((p) => [p.id, p.title]));
  const eventById = new Map(data.events.map((e) => [e.id, e]));

  const childFamOf = new Map<string, string>();
  const spouseFamsOf = new Map<string, string[]>();
  for (const f of data.families) {
    for (const c of f.childRefs) childFamOf.set(c.personId, f.id);
    for (const pid of [f.partner1Id, f.partner2Id]) {
      if (!pid) continue;
      const list = spouseFamsOf.get(pid) ?? [];
      list.push(f.id);
      spouseFamsOf.set(pid, list);
    }
  }

  const emitEvent = (level: number, e: ExportEvent) => {
    const tag = GED_TAG[e.type] ?? "EVEN";
    w(level, tag);
    if (tag === "EVEN") w(level + 1, "TYPE", e.type);
    const d = gedcomDate(e);
    if (d) w(level + 1, "DATE", d);
    if (e.placeId && placeById.get(e.placeId)) w(level + 1, "PLAC", placeById.get(e.placeId)!);
    if (e.description) w(level + 1, "NOTE", e.description.replace(/\r?\n/g, " "));
  };

  w(0, "HEAD");
  w(1, "SOUR", "FamilyCompass");
  w(2, "NAME", "Family Compass");
  w(1, "GEDC");
  w(2, "VERS", "5.5.1");
  w(2, "FORM", "LINEAGE-LINKED");
  w(1, "CHAR", "UTF-8");
  w(1, "DATE", new Date().toISOString().slice(0, 10));

  for (const p of data.people) {
    w(0, `${iId.get(p.id)}`, "INDI");
    const name = p.names.find((n) => n.preferred) ?? p.names[0];
    const given = [name?.title, name?.first].filter(Boolean).join(" ");
    const surname = [name?.surnamePrefix, name?.surname].filter(Boolean).join(" ");
    w(1, "NAME", `${given} /${surname}/${name?.suffix ? ` ${name.suffix}` : ""}`.trim());
    if (given) w(2, "GIVN", given);
    if (surname) w(2, "SURN", surname);
    if (name?.nick) w(2, "NICK", name.nick);
    w(1, "SEX", p.gender === "MALE" ? "M" : p.gender === "FEMALE" ? "F" : "U");
    for (const ref of p.eventRefs) {
      const e = eventById.get(ref.eventId);
      if (e) emitEvent(1, e);
    }
    const fc = childFamOf.get(p.id);
    if (fc) w(1, "FAMC", fId.get(fc)!);
    for (const fs of spouseFamsOf.get(p.id) ?? []) w(1, "FAMS", fId.get(fs)!);
  }

  for (const f of data.families) {
    w(0, `${fId.get(f.id)}`, "FAM");
    if (f.partner1Id && iId.get(f.partner1Id)) w(1, "HUSB", iId.get(f.partner1Id)!);
    if (f.partner2Id && iId.get(f.partner2Id)) w(1, "WIFE", iId.get(f.partner2Id)!);
    for (const c of f.childRefs) if (iId.get(c.personId)) w(1, "CHIL", iId.get(c.personId)!);
    for (const ref of f.eventRefs) {
      const e = eventById.get(ref.eventId);
      if (e) emitEvent(1, e);
    }
  }

  w(0, "TRLR");
  return lines.join("\n") + "\n";
}
