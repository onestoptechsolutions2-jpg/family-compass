import {
  ChildRelation,
  DateModifier,
  DateQuality,
  FamilyType,
  Gender,
  NameType,
} from "@prisma/client";

/** Provider-neutral shape both the Gramps and GEDCOM parsers produce. */

export type ImpDate = {
  modifier: DateModifier;
  quality: DateQuality;
  year: number | null;
  month: number | null;
  day: number | null;
  year2: number | null;
  month2: number | null;
  day2: number | null;
  text: string | null;
};

export type ImpName = {
  type: NameType;
  preferred: boolean;
  title?: string | null;
  first?: string | null;
  nick?: string | null;
  callName?: string | null;
  surnamePrefix?: string | null;
  surname?: string | null;
  suffix?: string | null;
};

export type ImpEventRef = { eventXref: string; role: string };

export type ImpPerson = {
  xref: string;
  sourceId: string | null;
  gender: Gender;
  living: boolean;
  names: ImpName[];
  eventRefs: ImpEventRef[];
};

export type ImpChildRef = {
  personXref: string;
  partner1Relation: ChildRelation;
  partner2Relation: ChildRelation;
};

export type ImpFamily = {
  xref: string;
  sourceId: string | null;
  type: FamilyType;
  partner1Xref: string | null;
  partner2Xref: string | null;
  children: ImpChildRef[];
  eventRefs: ImpEventRef[];
};

export type ImpEvent = {
  xref: string;
  sourceId: string | null;
  type: string;
  date: ImpDate | null;
  placeXref: string | null;
  placeName: string | null;
  description: string | null;
};

export type ImpPlace = {
  xref: string;
  sourceId: string | null;
  title: string;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ImpNote = { xref: string; sourceId: string | null; text: string };

export type ParsedTree = {
  people: ImpPerson[];
  families: ImpFamily[];
  events: ImpEvent[];
  places: ImpPlace[];
  notes: ImpNote[];
  warnings: string[];
};

export const EMPTY_PARSED: ParsedTree = {
  people: [],
  families: [],
  events: [],
  places: [],
  notes: [],
  warnings: [],
};

export function emptyDate(): ImpDate {
  return {
    modifier: DateModifier.NONE,
    quality: DateQuality.NONE,
    year: null,
    month: null,
    day: null,
    year2: null,
    month2: null,
    day2: null,
    text: null,
  };
}

/** Parse "YYYY-MM-DD" / "YYYY-MM" / "YYYY" (Gramps) or GEDCOM "12 JAN 1990". */
export function parseLooseDate(raw: string | null | undefined): ImpDate | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{3,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/.exec(s);
  if (iso) {
    const d = emptyDate();
    d.modifier = DateModifier.EXACT;
    d.year = Number(iso[1]);
    d.month = iso[2] ? Number(iso[2]) || null : null;
    d.day = iso[3] ? Number(iso[3]) || null : null;
    return d;
  }

  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const ged = /^(\d{1,2})\s+([A-Za-z]{3,})\.?\s+(\d{3,4})$/.exec(s);
  if (ged) {
    const d = emptyDate();
    d.modifier = DateModifier.EXACT;
    d.day = Number(ged[1]);
    d.month = MONTHS[ged[2]!.slice(0, 3).toLowerCase()] ?? null;
    d.year = Number(ged[3]);
    return d;
  }
  const gedYearMonth = /^([A-Za-z]{3,})\.?\s+(\d{3,4})$/.exec(s);
  if (gedYearMonth) {
    const d = emptyDate();
    d.modifier = DateModifier.EXACT;
    d.month = MONTHS[gedYearMonth[1]!.slice(0, 3).toLowerCase()] ?? null;
    d.year = Number(gedYearMonth[2]);
    return d;
  }
  const yearOnly = /(\d{3,4})/.exec(s);
  const d = emptyDate();
  if (yearOnly) {
    d.modifier = DateModifier.ABOUT;
    d.year = Number(yearOnly[1]);
    d.text = s;
    return d;
  }
  d.text = s;
  return d;
}

export function grampsNameType(attr: string | undefined): NameType {
  switch ((attr ?? "").toLowerCase()) {
    case "married name":
      return NameType.MARRIED;
    case "also known as":
    case "aka":
      return NameType.AKA;
    case "nickname":
      return NameType.NICKNAME;
    case "immigrant name":
      return NameType.IMMIGRANT;
    case "maiden name":
      return NameType.MAIDEN;
    case "birth name":
      return NameType.BIRTH;
    default:
      return NameType.BIRTH;
  }
}

export function grampsGender(g: string | undefined): Gender {
  switch ((g ?? "").trim().toUpperCase()) {
    case "M":
      return Gender.MALE;
    case "F":
      return Gender.FEMALE;
    case "X":
    case "O":
      return Gender.OTHER;
    default:
      return Gender.UNKNOWN;
  }
}

export function grampsFamilyType(rel: string | undefined): FamilyType {
  switch ((rel ?? "").toLowerCase()) {
    case "married":
      return FamilyType.MARRIED;
    case "unmarried":
    case "partners":
      return FamilyType.UNMARRIED;
    case "civil union":
      return FamilyType.CIVIL_UNION;
    default:
      return FamilyType.UNKNOWN;
  }
}

export function childRelation(v: string | undefined): ChildRelation {
  switch ((v ?? "").toLowerCase()) {
    case "adopted":
      return ChildRelation.ADOPTED;
    case "stepchild":
      return ChildRelation.STEPCHILD;
    case "foster":
      return ChildRelation.FOSTER;
    case "sponsored":
      return ChildRelation.SPONSORED;
    case "birth":
      return ChildRelation.BIRTH;
    default:
      return ChildRelation.UNKNOWN;
  }
}
