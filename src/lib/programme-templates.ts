/**
 * Starter funeral-programme templates. Each expands into day-grouped order-of-
 * service items the family then edits with the overlay item CRUD.
 * `{d1}` / `{d2}` are replaced with the day labels the wizard collects.
 */
export type TemplateItem = { day: string; title: string; detail?: string };

export type ProgrammeTemplate = {
  id: string;
  label: string;
  blurb: string;
  days: number;
  items: TemplateItem[];
};

const D1 = "{d1}";
const D2 = "{d2}";

export const PROGRAMME_TEMPLATES: ProgrammeTemplate[] = [
  {
    id: "christian-2day",
    label: "Christian service — two days",
    blurb: "Evening vigil / kesha on day one; church service and burial on day two.",
    days: 2,
    items: [
      { day: D1, title: "Arrival of the body", detail: "family & mortuary" },
      { day: D1, title: "Opening prayer" },
      { day: D1, title: "Hymn" },
      { day: D1, title: "Scripture reading" },
      { day: D1, title: "Word of comfort", detail: "clergy" },
      { day: D1, title: "Tributes from the community" },
      { day: D1, title: "Vote of thanks", detail: "family spokesperson" },
      { day: D1, title: "Closing prayer & overnight vigil (kesha)" },
      { day: D2, title: "Processional hymn" },
      { day: D2, title: "Opening prayer" },
      { day: D2, title: "Reading of the eulogy", detail: "family" },
      { day: D2, title: "Old Testament reading" },
      { day: D2, title: "New Testament reading" },
      { day: D2, title: "Hymn" },
      { day: D2, title: "Sermon", detail: "presiding clergy" },
      { day: D2, title: "Tributes", detail: "workmates, friends, church, family" },
      { day: D2, title: "Offertory & announcements" },
      { day: D2, title: "Final commendation & prayers" },
      { day: D2, title: "Recessional hymn" },
      { day: D2, title: "Journey to the home / cemetery" },
      { day: D2, title: "Committal & laying of wreaths" },
      { day: D2, title: "Words from the family" },
      { day: D2, title: "Closing prayer & benediction" },
      { day: D2, title: "Refreshments" },
    ],
  },
  {
    id: "christian-1day",
    label: "Christian service — one day",
    blurb: "Church service followed by burial the same day.",
    days: 1,
    items: [
      { day: D1, title: "Processional hymn" },
      { day: D1, title: "Opening prayer" },
      { day: D1, title: "Hymn" },
      { day: D1, title: "Scripture readings" },
      { day: D1, title: "Reading of the eulogy", detail: "family" },
      { day: D1, title: "Sermon", detail: "clergy" },
      { day: D1, title: "Tributes", detail: "friends, colleagues, church, family" },
      { day: D1, title: "Offertory & announcements" },
      { day: D1, title: "Final commendation" },
      { day: D1, title: "Recessional hymn" },
      { day: D1, title: "Committal at the graveside" },
      { day: D1, title: "Laying of wreaths" },
      { day: D1, title: "Vote of thanks", detail: "family" },
      { day: D1, title: "Closing prayer" },
      { day: D1, title: "Refreshments" },
    ],
  },
  {
    id: "celebration-of-life",
    label: "Celebration of life (non-religious)",
    blurb: "A memorial gathering with readings, music and shared memories.",
    days: 1,
    items: [
      { day: D1, title: "Welcome", detail: "master of ceremonies" },
      { day: D1, title: "Musical piece" },
      { day: D1, title: "Reading of the life story", detail: "family" },
      { day: D1, title: "A poem or reflection" },
      { day: D1, title: "Open sharing of memories" },
      { day: D1, title: "Tributes", detail: "friends & colleagues" },
      { day: D1, title: "Musical piece" },
      { day: D1, title: "A moment of silence" },
      { day: D1, title: "Words from the family" },
      { day: D1, title: "Closing remarks" },
      { day: D1, title: "Refreshments" },
    ],
  },
  {
    id: "muslim",
    label: "Muslim (Janazah)",
    blurb: "Bathing, shrouding, Salat al-Janazah and burial without delay.",
    days: 1,
    items: [
      { day: D1, title: "Ghusl (bathing of the body)" },
      { day: D1, title: "Kafan (shrouding)" },
      { day: D1, title: "Transport to the place of prayer" },
      { day: D1, title: "Salat al-Janazah (funeral prayer)", detail: "imam" },
      { day: D1, title: "Procession to the cemetery" },
      { day: D1, title: "Burial (Dafn)" },
      { day: D1, title: "Du'a for the deceased" },
      { day: D1, title: "Condolences (Ta'ziyah) at the family home" },
    ],
  },
];

export function expandTemplate(id: string, d1: string, d2: string): TemplateItem[] | null {
  const t = PROGRAMME_TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  const day1 = d1.trim() || "Day 1";
  const day2 = d2.trim() || "Day 2";
  return t.items.map((it) => ({
    ...it,
    day: it.day === D1 ? day1 : it.day === D2 ? day2 : it.day,
  }));
}
