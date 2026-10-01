import { isLayout, type Layout, type Pathway } from "@/lib/layouts";
import type { DraftOptions } from "@/lib/order-shared";
import { renderPrintSheet } from "@/lib/print-sheet";
import type { ProductOptions } from "@/lib/orders";

/** One believable family, so a card without a photo still shows what the customer will receive. */
const FAMILY: DraftOptions = {
  first: "Hesbon Okusimba",
  surname: "Musungu",
  birth: "1948",
  parents: "Joseph Musungu\nSelpha Ndakala",
  fatherParents: "Omukoko Khamala\nRebecca Mukhuyu",
  motherParents: "William Shitseswa\nJane Mukoma",
  children: "Willy Okusimba\nBilly Okusimba\nJane Okusimba",
};

const SAMPLE: Record<Layout, (pathway: Pathway) => DraftOptions> = {
  tree: (p) => ({ ...FAMILY, death: p === "REMEMBERED" ? "2026" : undefined }),
  banner: () => ({ ...FAMILY, title: "Musungu Family Reunion 2026", siblings: "Paul Musungu" }),
  wedding: () => ({
    first: "Ann", surname: "Kamau", spouse: "Tom Otieno", year: "14 December 2026", title: "The wedding of Ann and Tom",
    parents: "Peter Kamau\nMary Wanjiku", spouseParents: "David Otieno\nRuth Achieng",
  }),
  card: () => ({ first: "John", surname: "Kamau", birth: "1948", death: "2026", epitaph: "Gone from our sight, never from our hearts." }),
  calendar: () => ({
    surname: "Kamau", year: String(new Date().getFullYear() + 1), title: "The Kamau Family",
    birthdays: "Ann Kamau, 3 March 1985\nPeter Kamau, 17 March 1950\nMary Wanjiku, 9 June 1955\nLucy Otieno, 14 February 2012\nTom Otieno, 1 December 1982\nGrace Kamau, 25 December 1953",
  }),
  badges: () => ({
    title: "Kamau Family Reunion 2026", surname: "Kamau", first: "Peter",
    attendees: "Peter Kamau, Host\nMary Wanjiku, Aunt\nJames Kamau, Cousin\nAnn Kamau, Niece",
  }),
  shirt: () => ({ surname: "Kamau", title: "Family Reunion", year: "2026", place: "Kakamega" }),
};

const cache = new Map<string, string>();

/**
 * A rendered example of a product, as SVG at its real size, made once and kept.
 * It uses the product's own first material and size, so the example is what they get.
 * `version` changes when the product does, so an edited product is drawn again.
 */
export async function sampleSvg(
  p: { slug: string; layout: string; pathway: Pathway; options: unknown },
  origin: string,
  version = "",
): Promise<string> {
  const key = `${p.slug}:${version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const layout: Layout = isLayout(p.layout) ? p.layout : "tree";
  const po = (p.options ?? null) as ProductOptions | null;
  const options: DraftOptions = { ...SAMPLE[layout](p.pathway), materialKey: po?.materials?.[0]?.key, sizeKey: po?.sizes?.[0]?.key, finishKey: po?.finishes?.[0]?.key };
  const sheet = await renderPrintSheet(
    { options, productName: p.slug, qrUrl: `${origin}/q/example`, pathway: p.pathway, layout },
    options.sizeKey,
  );
  cache.set(key, sheet.svg);
  return sheet.svg;
}
