import { lines, type DraftOptions } from "@/lib/order-shared";

/**
 * What a piece costs, from its variants and from how much family it carries.
 * Pure on purpose: the same sums run in the browser (the live price) and on the
 * server (the price that is charged), so they can never disagree.
 *
 * Delivery is always included. Every figure is in whole shillings.
 */
export type Choice = { key: string; label: string; addKes: number };
export type ProductOptions = {
  materials?: Choice[];
  /** colour and finish: granite shade, wood tone, paper, frame, shirt colour */
  finishes?: Choice[];
  sizes?: Choice[];
  /** the piece includes this many generations; each one beyond costs `perExtraKes` more */
  generations?: { included: number; perExtraKes: number };
};

/** The groups of choices a customer makes, in the order they are asked. */
export const VARIANT_GROUPS = [
  { list: "materials", key: "materialKey", title: "Material" },
  { list: "finishes", key: "finishKey", title: "Colour and finish" },
  { list: "sizes", key: "sizeKey", title: "Size" },
] as const;

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
  for (const g of VARIANT_GROUPS) {
    const c = pick(po?.[g.list], o[g.key]);
    if (c && c.addKes) adds.push({ label: c.label, kes: c.addKes });
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
  const lo = (list?: Choice[]) => (list?.length ? Math.min(...list.map((c) => c.addKes)) : 0);
  const hi = (list?: Choice[]) => (list?.length ? Math.max(...list.map((c) => c.addKes)) : 0);
  const gens = po?.generations && (layout === "tree" || layout === "banner" || layout === "wedding") ? po.generations : null;
  const maxGens = layout === "wedding" ? 3 : 4;
  const extraMax = gens ? Math.max(0, maxGens - gens.included) * gens.perExtraKes : 0;
  const groups = [po?.materials, po?.finishes, po?.sizes];
  return {
    from: basePriceKes + groups.reduce((s, l) => s + lo(l), 0),
    to: basePriceKes + groups.reduce((s, l) => s + hi(l), 0) + extraMax,
  };
}
