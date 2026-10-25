import { amountDueNow, lines, type DraftOptions } from "@/lib/order-shared";

/**
 * What a piece costs, from its variants and from how much family it carries.
 * Pure on purpose: the same sums run in the browser (the live price) and on the
 * server (the price that is charged), so they can never disagree.
 *
 * Delivery is always included. Every figure is in whole shillings.
 */
export type Choice = {
  key: string;
  label: string;
  addKes: number;
  /** charged once per printed copy (pages, colour, paper on a programme); times the copies chosen */
  perCopyKes?: number;
};
export type ProductOptions = {
  materials?: Choice[];
  /** colour and finish: granite shade, wood tone, paper, frame, shirt colour */
  finishes?: Choice[];
  sizes?: Choice[];
  /** pages in a booklet such as a funeral programme */
  pages?: Choice[];
  /** how many are printed; the key is the number, e.g. "100" */
  copies?: Choice[];
  /** the piece includes this many generations; each one beyond costs `perExtraKes` more */
  generations?: { included: number; perExtraKes: number };
};

/** The groups of choices a customer makes, in the order they are asked. */
export const VARIANT_GROUPS = [
  { list: "materials", key: "materialKey", title: "Material" },
  { list: "finishes", key: "finishKey", title: "Colour and finish" },
  { list: "sizes", key: "sizeKey", title: "Size" },
  { list: "pages", key: "pagesKey", title: "Pages" },
  { list: "copies", key: "copiesKey", title: "Copies" },
] as const;
export type VariantList = (typeof VARIANT_GROUPS)[number]["list"];

/** The number of copies a copies choice stands for: its key ("100"), or one. */
export const copyCount = (c: Choice | undefined) => {
  const n = Number(c?.key);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

/** The first choice of every group, for a new design: { materialKey: "wood", ... }. */
export function firstChoices(po: ProductOptions | null): Partial<Record<(typeof VARIANT_GROUPS)[number]["key"], string>> {
  return Object.fromEntries(VARIANT_GROUPS.flatMap((g) => (po?.[g.list]?.[0] ? [[g.key, po[g.list]![0]!.key]] : [])));
}

/** Each chosen variant as "Title: Label", for people reading an order. */
export function chosenLabels(po: ProductOptions | null, o: Partial<Record<string, unknown>>): { title: string; label: string }[] {
  return VARIANT_GROUPS.flatMap((g) => {
    const c = po?.[g.list]?.find((x) => x.key === o[g.key]);
    return c ? [{ title: g.title, label: c.label }] : [];
  });
}

/** What one choice costs at a given number of copies. */
const choiceKes = (c: Choice, copies: number) => c.addKes + (c.perCopyKes ?? 0) * copies;

/**
 * How many generations a family piece shows: the person (and their brothers and
 * sisters, spouse), their parents, their grandparents, their children. Pieces that
 * are not family trees (cards, calendars, badges, shirts) have no generations.
 */
export function generationsOf(layout: string | undefined, o: DraftOptions): number | null {
  if (layout === "tree" || layout === "banner") {
    const up = lines(o.fatherParents).length || lines(o.motherParents).length ? 2 : lines(o.parents).length ? 1 : 0;
    return 1 + up + (lines(o.children).length ? 1 : 0);
  }
  if (layout === "wedding") return 2 + (lines(o.children).length ? 1 : 0);
  return null;
}

export type PriceLine = { label: string; kes: number };
export type Priced = {
  base: number;
  /** only what changes the price: a choice that costs extra, or extra generations */
  adds: PriceLine[];
  generations: number | null;
  /** generations the piece includes in its price, if it is priced that way */
  included: number | null;
  total: number;
};

const pick = (list: Choice[] | undefined, key: string | undefined) => list?.find((c) => c.key === key);

export function priceBreakdown(basePriceKes: number, po: ProductOptions | null, layout: string | undefined, o: DraftOptions): Priced {
  const adds: PriceLine[] = [];
  const copies = copyCount(pick(po?.copies, o.copiesKey));
  for (const g of VARIANT_GROUPS) {
    const c = pick(po?.[g.list], o[g.key]);
    const kes = c ? choiceKes(c, copies) : 0;
    if (c && kes) adds.push({ label: c.perCopyKes && copies > 1 ? `${c.label} (${copies} copies)` : c.label, kes });
  }
  const generations = generationsOf(layout, o);
  const gp = po?.generations;
  let included: number | null = null;
  if (gp && generations !== null) {
    included = gp.included;
    const extra = Math.max(0, generations - gp.included);
    if (extra > 0 && gp.perExtraKes > 0) {
      adds.push({ label: `${extra} extra ${extra === 1 ? "generation" : "generations"}`, kes: extra * gp.perExtraKes });
    }
  }
  return { base: basePriceKes, adds, generations, included, total: basePriceKes + adds.reduce((s, a) => s + a.kes, 0) };
}

/** The cheapest and the dearest a product can come to, for "From KES x". */
export function priceRange(basePriceKes: number, po: ProductOptions | null, layout: string | undefined): { from: number; to: number } {
  const gens = po?.generations && (layout === "tree" || layout === "banner" || layout === "wedding") ? po.generations : null;
  const maxGens = layout === "wedding" ? 3 : 4;
  const extraMax = gens ? Math.max(0, maxGens - gens.included) * gens.perExtraKes : 0;
  // per-copy prices depend on the copies chosen, so try each number of copies
  const copyChoices: (Choice | undefined)[] = po?.copies?.length ? po.copies : [undefined];
  let from = Infinity;
  let to = -Infinity;
  for (const cc of copyChoices) {
    const n = copyCount(cc);
    let lo = cc ? choiceKes(cc, n) : 0;
    let hi = lo;
    for (const g of VARIANT_GROUPS) {
      if (g.list === "copies") continue;
      const list = po?.[g.list];
      if (!list?.length) continue;
      const costs = list.map((c) => choiceKes(c, n));
      lo += Math.min(...costs);
      hi += Math.max(...costs);
    }
    from = Math.min(from, lo);
    to = Math.max(to, hi);
  }
  return { from: basePriceKes + from, to: basePriceKes + to + extraMax };
}

/**
 * The price a product is advertised at: exactly what the customer sees when they start, with
 * the first choice of each group picked, rounded as it is charged. "from" is that price, and
 * "to" the dearest it can come to, so "From KES x" never rises before they change anything.
 */
export function listPrice(basePriceKes: number, po: ProductOptions | null, layout: string | undefined): { from: number; to: number } {
  const from = amountDueNow(priceBreakdown(basePriceKes, po, layout, firstChoices(po)).total);
  return { from, to: Math.max(from, amountDueNow(priceRange(basePriceKes, po, layout).to)) };
}
