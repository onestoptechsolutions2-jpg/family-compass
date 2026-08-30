import zlib from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { DateModifier, DateQuality } from "@prisma/client";

import {
  type ImpDate,
  type ImpEvent,
  type ImpFamily,
  type ImpName,
  type ImpNote,
  type ImpPerson,
  type ImpPlace,
  type ParsedTree,
  childRelation,
  emptyDate,
  grampsFamilyType,
  grampsGender,
  grampsNameType,
} from "./intermediate";

const arr = <T,>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

const text = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    const t = (v as Record<string, unknown>)["#text"];
    return t == null ? null : String(t).trim() || null;
  }
  return null;
};

function maybeGunzip(bytes: Buffer): string {
  if (bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    return zlib.gunzipSync(bytes).toString("utf8");
  }
  return bytes.toString("utf8");
}

function parseDateEl(el: Record<string, unknown>): ImpDate | null {
  const dv = el.dateval as Record<string, unknown> | undefined;
  const dr = el.daterange as Record<string, unknown> | undefined;
  const ds = el.datespan as Record<string, unknown> | undefined;
  const dstr = el.datestr as Record<string, unknown> | undefined;

  const quality = (raw: unknown): DateQuality =>
    raw === "estimated"
      ? DateQuality.ESTIMATED
      : raw === "calculated"
        ? DateQuality.CALCULATED
        : DateQuality.NONE;

  const split = (val: string | undefined) => {
    const m = /^(\d{3,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec((val ?? "").trim());
    if (!m) return { y: null, mo: null, d: null };
    return {
      y: Number(m[1]) || null,
      mo: m[2] ? Number(m[2]) || null : null,
      d: m[3] ? Number(m[3]) || null : null,
    };
  };

  if (dv) {
    const { y, mo, d } = split(dv["@_val"] as string);
    if (!y && !dv["@_val"]) return null;
    const out = emptyDate();
    const t = dv["@_type"] as string | undefined;
    out.modifier =
      t === "before"
        ? DateModifier.BEFORE
        : t === "after"
          ? DateModifier.AFTER
          : t === "about"
            ? DateModifier.ABOUT
            : DateModifier.EXACT;
    out.quality = quality(dv["@_quality"]);
    out.year = y;
    out.month = mo;
    out.day = d;
    return out;
  }
  if (dr || ds) {
    const src = (dr ?? ds) as Record<string, unknown>;
    const a = split(src["@_start"] as string);
    const b = split(src["@_stop"] as string);
    const out = emptyDate();
    out.modifier = dr ? DateModifier.RANGE : DateModifier.SPAN;
    out.quality = quality(src["@_quality"]);
    out.year = a.y;
    out.month = a.mo;
    out.day = a.d;
    out.year2 = b.y;
    out.month2 = b.mo;
    out.day2 = b.d;
    return out;
  }
  if (dstr) {
    const out = emptyDate();
    out.text = ((dstr["@_val"] as string) ?? "").trim() || null;
    return out.text ? out : null;
  }
  return null;
}

export function parseGrampsXml(bytes: Buffer): ParsedTree {
  const xml = maybeGunzip(bytes);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
    isArray: (name) =>
      [
        "person",
        "family",
        "event",
        "placeobj",
        "note",
        "name",
        "eventref",
        "childof",
        "parentin",
        "childref",
        "surname",
      ].includes(name),
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const database = doc.database as Record<string, unknown> | undefined;
  if (!database) throw new Error("Not a Gramps XML file (no <database> element)");

  const warnings: string[] = [];
  const container = (key: string, child: string) =>
    arr((database[key] as Record<string, unknown> | undefined)?.[child] as unknown);

  // ---- Places ----
  const places: ImpPlace[] = container("places", "placeobj").map((raw) => {
    const p = raw as Record<string, unknown>;
    const pname = p.pname as Record<string, unknown> | undefined;
    const coord = p.coord as Record<string, unknown> | undefined;
    const title =
      text(p.ptitle) ??
      (pname?.["@_value"] as string) ??
      text(p.pname) ??
      "Unnamed place";
    return {
      xref: (p["@_handle"] as string) ?? (p["@_id"] as string),
      sourceId: (p["@_id"] as string) ?? null,
      title,
      type: (p["@_type"] as string) ?? null,
      latitude: coord?.["@_lat"] != null ? Number(coord["@_lat"]) : null,
      longitude: coord?.["@_long"] != null ? Number(coord["@_long"]) : null,
    };
  });

  // ---- Events ----
  const events: ImpEvent[] = container("events", "event").map((raw) => {
    const e = raw as Record<string, unknown>;
    const place = e.place as Record<string, unknown> | undefined;
    return {
      xref: (e["@_handle"] as string) ?? (e["@_id"] as string),
      sourceId: (e["@_id"] as string) ?? null,
      type: text(e.type) ?? "Event",
      date: parseDateEl(e),
      placeXref: (place?.["@_hlink"] as string) ?? null,
      placeName: null,
      description: text(e.description),
    };
  });

  // ---- People ----
  const people: ImpPerson[] = container("people", "person").map((raw) => {
    const p = raw as Record<string, unknown>;
    const names: ImpName[] = arr(p.name as unknown).map((n, i) => {
      const nn = n as Record<string, unknown>;
      const surnameEl = arr(nn.surname as unknown)[0] as
        | Record<string, unknown>
        | string
        | undefined;
      const surname =
        typeof surnameEl === "string"
          ? surnameEl
          : (text(surnameEl) ?? null);
      const surnamePrefix =
        surnameEl && typeof surnameEl !== "string"
          ? ((surnameEl["@_prefix"] as string) ?? null)
          : null;
      return {
        type: grampsNameType(nn["@_type"] as string),
        preferred: i === 0,
        first: text(nn.first),
        nick: text(nn.nick),
        callName: text(nn.call),
        title: text(nn.title),
        suffix: text(nn.suffix),
        surname,
        surnamePrefix,
      };
    });
    if (names.length === 0) {
      names.push({ type: grampsNameType(undefined), preferred: true, first: null, surname: null });
    }
    return {
      xref: (p["@_handle"] as string) ?? (p["@_id"] as string),
      sourceId: (p["@_id"] as string) ?? null,
      gender: grampsGender(text(p.gender) ?? undefined),
      living: false,
      names,
      eventRefs: arr(p.eventref as unknown).map((r) => {
        const rr = r as Record<string, unknown>;
        return { eventXref: rr["@_hlink"] as string, role: (rr["@_role"] as string) ?? "Primary" };
      }),
    };
  });

  // ---- Families ----
  const families: ImpFamily[] = container("families", "family").map((raw) => {
    const f = raw as Record<string, unknown>;
    const father = f.father as Record<string, unknown> | undefined;
    const mother = f.mother as Record<string, unknown> | undefined;
    const rel = f.rel as Record<string, unknown> | undefined;
    return {
      xref: (f["@_handle"] as string) ?? (f["@_id"] as string),
      sourceId: (f["@_id"] as string) ?? null,
      type: grampsFamilyType(rel?.["@_type"] as string),
      partner1Xref: (father?.["@_hlink"] as string) ?? null,
      partner2Xref: (mother?.["@_hlink"] as string) ?? null,
      children: arr(f.childref as unknown).map((c) => {
        const cc = c as Record<string, unknown>;
        return {
          personXref: cc["@_hlink"] as string,
          partner1Relation: childRelation(cc["@_frel"] as string),
          partner2Relation: childRelation(cc["@_mrel"] as string),
        };
      }),
      eventRefs: arr(f.eventref as unknown).map((r) => {
        const rr = r as Record<string, unknown>;
        return { eventXref: rr["@_hlink"] as string, role: (rr["@_role"] as string) ?? "Family" };
      }),
    };
  });

  // ---- Notes ----
  const notes: ImpNote[] = container("notes", "note")
    .map((raw) => {
      const n = raw as Record<string, unknown>;
      return {
        xref: (n["@_handle"] as string) ?? (n["@_id"] as string),
        sourceId: (n["@_id"] as string) ?? null,
        text: text(n.text) ?? "",
      };
    })
    .filter((n) => n.text);

  for (const key of ["sources", "citations", "repositories", "objects"]) {
    const n = arr((database[key] as Record<string, unknown> | undefined)?.[key.slice(0, -1)] as unknown).length;
    if (n) warnings.push(`Skipped ${n} ${key} (not imported in this version)`);
  }

  return { people, families, events, places, notes, warnings };
}
