/**
 * Reference starter for communities and clans. Deliberately partial and
 * conservative — it exists to bootstrap autocomplete and the /communities
 * pages, and is meant to be corrected and extended by the families themselves.
 * Every row is marked as a starter to be verified.
 */

type Entry = { community: string; name: string; aka?: string; totem?: string; region?: string; notes?: string };

const SRC = "Reference starter — verify with your family";

// ---- Luhya sub-nations (Western Kenya). These sub-nations are themselves
//      often treated as the clan/identity; named sub-clans vary by family. ----
const LUHYA: Entry[] = [
  { community: "Luhya", name: "Bukusu", aka: "Babukusu", region: "Bungoma / Trans-Nzoia" },
  { community: "Luhya", name: "Maragoli", aka: "Logoli / Avalogooli", region: "Vihiga" },
  { community: "Luhya", name: "Isukha", aka: "Abisukha", region: "Kakamega (Shinyalu)" },
  { community: "Luhya", name: "Idakho", aka: "Abidakho", region: "Kakamega (Ikolomani)" },
  { community: "Luhya", name: "Tiriki", aka: "Abatirichi", region: "Vihiga (Hamisi)" },
  { community: "Luhya", name: "Banyore", aka: "Abanyore", region: "Vihiga (Emuhaya)" },
  { community: "Luhya", name: "Wanga", aka: "Abawanga", region: "Kakamega (Mumias)" },
  { community: "Luhya", name: "Marama", aka: "Abamarama", region: "Kakamega (Butere)" },
  { community: "Luhya", name: "Kisa", aka: "Abashisa", region: "Kakamega (Khwisero)" },
  { community: "Luhya", name: "Kabras", aka: "Abakabarasi", region: "Kakamega (Malava)" },
  { community: "Luhya", name: "Tachoni", aka: "Abatachoni", region: "Bungoma / Kakamega" },
  { community: "Luhya", name: "Batsotso", aka: "Abatsotso", region: "Kakamega (Lurambi)" },
  { community: "Luhya", name: "Khayo", aka: "Abakhayo", region: "Busia" },
  { community: "Luhya", name: "Marachi", aka: "Abamarachi", region: "Busia (Butula)" },
  { community: "Luhya", name: "Samia", aka: "Abasamia", region: "Busia (Funyula)" },
  { community: "Luhya", name: "Nyala", aka: "Abanyala", region: "Busia / Kakamega (Navakholo)" },
  { community: "Luhya", name: "Bunyala", aka: "Abanyala ba Busia", region: "Busia (Budalangi)" },
];

// ---- Luo clans (Nyanza). ----
const LUO: Entry[] = [
  { community: "Luo", name: "Sakwa", region: "Siaya (Bondo)" },
  { community: "Luo", name: "Asembo", region: "Siaya (Rarieda)" },
  { community: "Luo", name: "Uyoma", region: "Siaya (Rarieda)" },
  { community: "Luo", name: "Yimbo", region: "Siaya (Bondo)" },
  { community: "Luo", name: "Alego", region: "Siaya" },
  { community: "Luo", name: "Gem", region: "Siaya" },
  { community: "Luo", name: "Ugenya", region: "Siaya" },
  { community: "Luo", name: "Seme", region: "Kisumu" },
  { community: "Luo", name: "Kano", region: "Kisumu (Nyando)" },
  { community: "Luo", name: "Nyakach", region: "Kisumu" },
  { community: "Luo", name: "Karachuonyo", region: "Homa Bay" },
  { community: "Luo", name: "Kabondo", region: "Homa Bay" },
  { community: "Luo", name: "Gwassi", region: "Homa Bay (Suba)" },
  { community: "Luo", name: "Kadem", region: "Migori (Nyatike)" },
  { community: "Luo", name: "Kanyamkago", region: "Migori" },
  { community: "Luo", name: "Suna", region: "Migori" },
];

// ---- Kikuyu mĩhĩrĩga (the nine-plus clans). ----
const KIKUYU: Entry[] = [
  { community: "Kikuyu", name: "Anjirũ" },
  { community: "Kikuyu", name: "Agachikũ" },
  { community: "Kikuyu", name: "Airimũ", aka: "Agathigia" },
  { community: "Kikuyu", name: "Ambũi" },
  { community: "Kikuyu", name: "Angarĩ", aka: "Aithĩekahuno" },
  { community: "Kikuyu", name: "Aithĩrandũ" },
  { community: "Kikuyu", name: "Aithaga" },
  { community: "Kikuyu", name: "Aicakamũyũ" },
  { community: "Kikuyu", name: "Ethaga", aka: "Aithiegeni" },
  { community: "Kikuyu", name: "Aacera", aka: "Angũi" },
];

// ---- Kamba (Ũkamba) — a few widely-cited clans; verify locally. ----
const KAMBA: Entry[] = [
  { community: "Kamba", name: "Aombe", notes: "widely cited; verify" },
  { community: "Kamba", name: "Atangwa", notes: "widely cited; verify" },
  { community: "Kamba", name: "Aewani", notes: "widely cited; verify" },
  { community: "Kamba", name: "Akitondu", notes: "widely cited; verify" },
  { community: "Kamba", name: "Anziũ", notes: "widely cited; verify" },
];

// ---- Kalenjin — sub-nations (the clan/oret system is more granular). ----
const KALENJIN: Entry[] = [
  { community: "Kalenjin", name: "Kipsigis", region: "Kericho / Bomet" },
  { community: "Kalenjin", name: "Nandi", region: "Nandi" },
  { community: "Kalenjin", name: "Keiyo", region: "Elgeyo-Marakwet" },
  { community: "Kalenjin", name: "Marakwet", region: "Elgeyo-Marakwet" },
  { community: "Kalenjin", name: "Tugen", region: "Baringo" },
  { community: "Kalenjin", name: "Pokot", region: "West Pokot / Baringo" },
  { community: "Kalenjin", name: "Sabaot", region: "Mt Elgon (Bungoma)" },
  { community: "Kalenjin", name: "Terik", region: "Nandi / Vihiga" },
];

export const REFERENCE_CLAN_ROWS: Entry[] = [
  ...LUHYA,
  ...LUO,
  ...KIKUYU,
  ...KAMBA,
  ...KALENJIN,
].map((e) => ({ ...e, notes: e.notes ?? SRC }));
