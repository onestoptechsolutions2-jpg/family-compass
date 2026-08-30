import zlib from "node:zlib";
import { DateModifier } from "@prisma/client";

import type { ExportData, ExportEvent } from "./load";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const handle = (id: string) => `_${id.replace(/[^a-zA-Z0-9]/g, "")}`;

function grampsGender(g: string) {
  return g === "MALE" ? "M" : g === "FEMALE" ? "F" : "U";
}

function iso(y: number | null, m: number | null, d: number | null): string | null {
  if (!y) return null;
  return `${String(y).padStart(4, "0")}-${String(m ?? 0).padStart(2, "0")}-${String(d ?? 0).padStart(2, "0")}`;
}

function dateEl(e: ExportEvent, indent: string): string {
  const a = iso(e.dateYear, e.dateMonth, e.dateDay);
  const b = iso(e.dateYear2, e.dateMonth2, e.dateDay2);
  const quality =
    e.dateQuality === "ESTIMATED"
      ? ' quality="estimated"'
      : e.dateQuality === "CALCULATED"
        ? ' quality="calculated"'
        : "";
  switch (e.dateModifier) {
    case DateModifier.EXACT:
      return a ? `${indent}<dateval val="${a}"${quality}/>\n` : "";
    case DateModifier.ABOUT:
      return a ? `${indent}<dateval val="${a}" type="about"${quality}/>\n` : "";
    case DateModifier.BEFORE:
      return a ? `${indent}<dateval val="${a}" type="before"${quality}/>\n` : "";
    case DateModifier.AFTER:
      return a ? `${indent}<dateval val="${a}" type="after"${quality}/>\n` : "";
    case DateModifier.RANGE:
      return a && b ? `${indent}<daterange start="${a}" stop="${b}"${quality}/>\n` : "";
    case DateModifier.SPAN:
      return a && b ? `${indent}<datespan start="${a}" stop="${b}"${quality}/>\n` : "";
    default:
      return e.dateText ? `${indent}<datestr val="${esc(e.dateText)}"/>\n` : "";
  }
}

/** Serialise a tree to Gramps XML 1.7.1 and gzip it (a valid .gramps file). */
export function toGrampsXml(data: ExportData): Buffer {
  const now = new Date().toISOString().slice(0, 10);
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    '<!DOCTYPE database PUBLIC "-//Gramps//DTD Gramps XML 1.7.1//EN" "http://gramps-project.org/xml/1.7.1/grampsxml.dtd">',
  );
  out.push('<database xmlns="http://gramps-project.org/xml/1.7.1/">');
  out.push("  <header>");
  out.push(`    <created date="${now}" version="FamilyCompass-1"/>`);
  out.push(`    <researcher><resname>${esc(data.tree.name)}</resname></researcher>`);
  out.push("  </header>");

  // events
  out.push("  <events>");
  data.events.forEach((e, i) => {
    out.push(`    <event handle="${handle(e.id)}" id="E${String(i).padStart(4, "0")}">`);
    out.push(`      <type>${esc(e.type)}</type>`);
    const d = dateEl(e, "      ");
    if (d) out.push(d.trimEnd());
    if (e.description) out.push(`      <description>${esc(e.description)}</description>`);
    if (e.placeId) out.push(`      <place hlink="${handle(e.placeId)}"/>`);
    out.push("    </event>");
  });
  out.push("  </events>");

  // places
  out.push("  <places>");
  data.places.forEach((p, i) => {
    out.push(`    <placeobj handle="${handle(p.id)}" id="P${String(i).padStart(4, "0")}" type="Unknown">`);
    out.push(`      <ptitle>${esc(p.title)}</ptitle>`);
    out.push(`      <pname value="${esc(p.title)}"/>`);
    if (p.latitude != null && p.longitude != null)
      out.push(`      <coord long="${p.longitude}" lat="${p.latitude}"/>`);
    out.push("    </placeobj>");
  });
  out.push("  </places>");

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
  const personEvents = new Map<string, string[]>();
  for (const p of data.people) personEvents.set(p.id, p.eventRefs.map((r) => r.eventId));

  // people
  out.push("  <people>");
  data.people.forEach((p, i) => {
    out.push(`    <person handle="${handle(p.id)}" id="I${String(i).padStart(4, "0")}">`);
    out.push(`      <gender>${grampsGender(p.gender)}</gender>`);
    for (const n of p.names.length ? p.names : [null]) {
      out.push(`      <name type="${n?.type === "MARRIED" ? "Married Name" : "Birth Name"}">`);
      if (n?.first) out.push(`        <first>${esc(n.first)}</first>`);
      if (n?.surname)
        out.push(
          `        <surname${n.surnamePrefix ? ` prefix="${esc(n.surnamePrefix)}"` : ""}>${esc(n.surname)}</surname>`,
        );
      if (n?.suffix) out.push(`        <suffix>${esc(n.suffix)}</suffix>`);
      if (n?.title) out.push(`        <title>${esc(n.title)}</title>`);
      if (n?.nick) out.push(`        <nick>${esc(n.nick)}</nick>`);
      out.push("      </name>");
    }
    for (const eid of personEvents.get(p.id) ?? [])
      out.push(`      <eventref hlink="${handle(eid)}" role="Primary"/>`);
    const fc = childFamOf.get(p.id);
    if (fc) out.push(`      <childof hlink="${handle(fc)}"/>`);
    for (const fs of spouseFamsOf.get(p.id) ?? [])
      out.push(`      <parentin hlink="${handle(fs)}"/>`);
    out.push("    </person>");
  });
  out.push("  </people>");

  // families
  out.push("  <families>");
  data.families.forEach((f, i) => {
    out.push(`    <family handle="${handle(f.id)}" id="F${String(i).padStart(4, "0")}">`);
    out.push(
      `      <rel type="${f.type === "MARRIED" ? "Married" : f.type === "UNMARRIED" ? "Unmarried" : "Unknown"}"/>`,
    );
    if (f.partner1Id) out.push(`      <father hlink="${handle(f.partner1Id)}"/>`);
    if (f.partner2Id) out.push(`      <mother hlink="${handle(f.partner2Id)}"/>`);
    for (const c of f.childRefs) out.push(`      <childref hlink="${handle(c.personId)}"/>`);
    for (const ref of f.eventRefs)
      out.push(`      <eventref hlink="${handle(ref.eventId)}" role="Family"/>`);
    out.push("    </family>");
  });
  out.push("  </families>");

  out.push("</database>");
  return zlib.gzipSync(Buffer.from(out.join("\n") + "\n", "utf8"), { level: 9 });
}
