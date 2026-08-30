import { DateModifier, FamilyType, NameType } from "@prisma/client";

import {
  type ImpEvent,
  type ImpFamily,
  type ImpName,
  type ImpNote,
  type ImpPerson,
  type ImpPlace,
  type ParsedTree,
  childRelation,
  emptyDate,
  grampsGender,
  parseLooseDate,
} from "./intermediate";

type Node = {
  level: number;
  tag: string;
  xref: string | null;
  value: string;
  children: Node[];
};

function parseLines(input: string): Node[] {
  const root: Node[] = [];
  const stack: { node: Node; level: number }[] = [];

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.replace(/^﻿/, "").trimEnd();
    if (!line.trim()) continue;
    const m = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s(.*))?$/.exec(line);
    if (!m) continue;
    const level = Number(m[1]);
    let xref: string | null = m[2] ?? null;
    let tag = m[3]!;
    let value = m[4] ?? "";
    // "0 @I1@ INDI" — xref precedes tag. "1 NAME John /Smith/" — normal.
    if (!xref && /^@[^@]+@$/.test(tag)) {
      xref = tag;
      tag = value;
      value = "";
    }
    const node: Node = { level, tag, xref, value, children: [] };

    while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
    if (stack.length === 0) root.push(node);
    else stack[stack.length - 1]!.node.children.push(node);
    stack.push({ node, level });
  }
  return root;
}

const child = (n: Node, tag: string) => n.children.find((c) => c.tag === tag);
const childrenOf = (n: Node, tag: string) => n.children.filter((c) => c.tag === tag);

/** "12 JAN 1900", "ABT 1900", "BEF 1900", "BET 1900 AND 1910". */
function gedDate(node: Node | undefined) {
  const raw = node ? contValue(node) : "";
  if (!raw) return null;
  const s = raw.trim();
  const between = /^BET\s+(.+?)\s+AND\s+(.+)$/i.exec(s);
  if (between) {
    const a = parseLooseDate(between[1]!);
    const b = parseLooseDate(between[2]!);
    const d = emptyDate();
    d.modifier = DateModifier.RANGE;
    d.year = a?.year ?? null;
    d.month = a?.month ?? null;
    d.day = a?.day ?? null;
    d.year2 = b?.year ?? null;
    d.month2 = b?.month ?? null;
    d.day2 = b?.day ?? null;
    return d;
  }
  const pref = /^(ABT|EST|CAL|BEF|AFT)\s+(.+)$/i.exec(s);
  if (pref) {
    const inner = parseLooseDate(pref[2]!) ?? emptyDate();
    const key = pref[1]!.toUpperCase();
    inner.modifier =
      key === "BEF"
        ? DateModifier.BEFORE
        : key === "AFT"
          ? DateModifier.AFTER
          : DateModifier.ABOUT;
    return inner;
  }
  return parseLooseDate(s);
}

/** Concatenate CONC/CONT continuation lines. */
function contValue(node: Node): string {
  let out = node.value;
  for (const c of node.children) {
    if (c.tag === "CONC") out += c.value;
    else if (c.tag === "CONT") out += "\n" + c.value;
  }
  return out;
}

const EVENT_LABELS: Record<string, string> = {
  BIRT: "Birth",
  DEAT: "Death",
  BURI: "Burial",
  CREM: "Cremation",
  CHR: "Christening",
  BAPM: "Baptism",
  ADOP: "Adoption",
  GRAD: "Graduation",
  RETI: "Retirement",
  EMIG: "Emigration",
  IMMI: "Immigration",
  NATU: "Naturalization",
  CENS: "Census",
  OCCU: "Occupation",
  RESI: "Residence",
  EDUC: "Education",
  RELI: "Religion",
  MARR: "Marriage",
  DIV: "Divorce",
  ENGA: "Engagement",
  MARB: "Marriage Banns",
  ANUL: "Annulment",
};

export function parseGedcom(bytes: Buffer): ParsedTree {
  const nodes = parseLines(bytes.toString("utf8"));
  const warnings: string[] = [];

  const indiNodes = nodes.filter((n) => n.tag === "INDI" && n.xref);
  const famNodes = nodes.filter((n) => n.tag === "FAM" && n.xref);
  const noteNodes = nodes.filter((n) => n.tag === "NOTE" && n.xref);

  const events: ImpEvent[] = [];
  const places: ImpPlace[] = [];
  const placeByName = new Map<string, string>();

  const placeXref = (name: string | undefined): string | null => {
    const t = (name ?? "").trim();
    if (!t) return null;
    if (!placeByName.has(t)) {
      const xref = `P${placeByName.size + 1}`;
      placeByName.set(t, xref);
      places.push({ xref, sourceId: null, title: t, type: null, latitude: null, longitude: null });
    }
    return placeByName.get(t)!;
  };

  const collectEvents = (rec: Node, ownerXref: string, defaultRole: string): { eventXref: string; role: string }[] => {
    const refs: { eventXref: string; role: string }[] = [];
    rec.children.forEach((c, i) => {
      const label = EVENT_LABELS[c.tag];
      if (!label) return;
      const xref = `${ownerXref}:${c.tag}:${i}`;
      events.push({
        xref,
        sourceId: null,
        type: label,
        date: gedDate(child(c, "DATE")),
        placeXref: placeXref(child(c, "PLAC")?.value),
        placeName: child(c, "PLAC")?.value ?? null,
        description: child(c, "TYPE")?.value || contValue(c).trim() || null,
      });
      refs.push({ eventXref: xref, role: defaultRole });
    });
    return refs;
  };

  const people: ImpPerson[] = indiNodes.map((rec) => {
    const xref = rec.xref!;
    const names: ImpName[] = childrenOf(rec, "NAME").map((nn, i) => {
      const slash = /^(.*?)\s*\/([^/]*)\/\s*(.*)$/.exec(nn.value);
      const given = child(nn, "GIVN")?.value || slash?.[1] || nn.value.replace(/\/.*\//, "").trim();
      const surname = child(nn, "SURN")?.value || slash?.[2] || null;
      return {
        type: NameType.BIRTH,
        preferred: i === 0,
        first: given?.trim() || null,
        surname: surname?.trim() || null,
        surnamePrefix: child(nn, "SPFX")?.value || null,
        suffix: child(nn, "NSFX")?.value || slash?.[3]?.trim() || null,
        title: child(nn, "NPFX")?.value || null,
        nick: child(nn, "NICK")?.value || null,
      };
    });
    if (names.length === 0) {
      names.push({ type: NameType.BIRTH, preferred: true, first: null, surname: null });
    }
    return {
      xref,
      sourceId: xref.replace(/@/g, ""),
      gender: grampsGender(child(rec, "SEX")?.value),
      living: !child(rec, "DEAT"),
      names,
      eventRefs: collectEvents(rec, xref, "Primary"),
    };
  });

  const families: ImpFamily[] = famNodes.map((rec) => {
    const xref = rec.xref!;
    return {
      xref,
      sourceId: xref.replace(/@/g, ""),
      type: child(rec, "MARR") ? FamilyType.MARRIED : FamilyType.UNKNOWN,
      partner1Xref: child(rec, "HUSB")?.value ?? null,
      partner2Xref: child(rec, "WIFE")?.value ?? null,
      children: childrenOf(rec, "CHIL").map((c) => ({
        personXref: c.value,
        partner1Relation: childRelation(undefined),
        partner2Relation: childRelation(undefined),
      })),
      eventRefs: collectEvents(rec, xref, "Family"),
    };
  });

  const notes: ImpNote[] = noteNodes
    .map((n) => ({ xref: n.xref!, sourceId: n.xref!.replace(/@/g, ""), text: contValue(n).trim() }))
    .filter((n) => n.text);

  if (people.length === 0 && families.length === 0) {
    throw new Error("No INDI or FAM records found — is this a GEDCOM file?");
  }

  return { people, families, events, places, notes, warnings };
}
