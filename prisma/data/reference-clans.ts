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

// ---- Abagusii (Kisii) — clans. ----
const KISII: Entry[] = [
  { community: "Kisii", name: "Abagirango", region: "Kisii" },
  { community: "Kisii", name: "Abagetutu", region: "Kisii" },
  { community: "Kisii", name: "Abanchari", region: "Kisii (Bonchari)" },
  { community: "Kisii", name: "Abamachoge", region: "Kisii" },
  { community: "Kisii", name: "Abasweta", region: "Kisii / Nyamira" },
  { community: "Kisii", name: "Abanyaribari", region: "Kisii" },
  { community: "Kisii", name: "Abakisii-Bosongo", region: "Kisii" },
  { community: "Kisii", name: "Abamugusii", region: "Nyamira" },
  { community: "Kisii", name: "Abagusii ba Wanjare", aka: "Abanyaribari Wanjare", region: "Kisii" },
];

// ---- Abakuria (Kuria) — the main clans (ibiaro). ----
const KURIA: Entry[] = [
  { community: "Kuria", name: "Abanyabasi", region: "Migori (Kuria East)" },
  { community: "Kuria", name: "Abagumbe", region: "Migori (Kuria West)" },
  { community: "Kuria", name: "Abairege", region: "Migori (Kuria West)" },
  { community: "Kuria", name: "Abakira", region: "Migori" },
  { community: "Kuria", name: "Abanyamongo", region: "Migori" },
  { community: "Kuria", name: "Abatimbaru", region: "Migori" },
];

// ---- Meru — the sub-groups / njuri sections. ----
const MERU: Entry[] = [
  { community: "Meru", name: "Imenti", region: "Meru (North/Central/South Imenti)" },
  { community: "Meru", name: "Tigania", region: "Meru (Tigania East/West)" },
  { community: "Meru", name: "Igembe", region: "Meru (Igembe)" },
  { community: "Meru", name: "Miutini", region: "Meru" },
  { community: "Meru", name: "Igoji", region: "Meru (South Imenti)" },
  { community: "Meru", name: "Mwimbi", region: "Tharaka-Nithi (Maara)" },
  { community: "Meru", name: "Muthambi", region: "Tharaka-Nithi (Maara)" },
  { community: "Meru", name: "Chuka", region: "Tharaka-Nithi" },
  { community: "Meru", name: "Tharaka", region: "Tharaka-Nithi (Tharaka)" },
  { community: "Meru", name: "Mwimbi-Muthambi", region: "Tharaka-Nithi" },
];

// ---- Embu / Mbeere. ----
const EMBU: Entry[] = [
  { community: "Embu", name: "Embu (Aembu)", region: "Embu" },
  { community: "Embu", name: "Mbeere (Ambeere)", region: "Embu (Mbeere North/South)" },
];

// ---- Mijikenda — the nine sub-groups. ----
const MIJIKENDA: Entry[] = [
  { community: "Mijikenda", name: "Giriama", aka: "Agiryama", region: "Kilifi" },
  { community: "Mijikenda", name: "Digo", region: "Kwale" },
  { community: "Mijikenda", name: "Duruma", region: "Kwale (Kinango)" },
  { community: "Mijikenda", name: "Chonyi", region: "Kilifi" },
  { community: "Mijikenda", name: "Kambe", region: "Kilifi (Rabai)" },
  { community: "Mijikenda", name: "Ribe", region: "Kilifi (Rabai)" },
  { community: "Mijikenda", name: "Rabai", region: "Kilifi (Rabai)" },
  { community: "Mijikenda", name: "Jibana", region: "Kilifi" },
  { community: "Mijikenda", name: "Kauma", region: "Kilifi" },
];

// ---- Taita. ----
const TAITA: Entry[] = [
  { community: "Taita", name: "Wadawida", aka: "Dawida", region: "Taita-Taveta (Wundanyi/Mwatate)" },
  { community: "Taita", name: "Wasaghala", aka: "Saghala", region: "Taita-Taveta (Voi)" },
  { community: "Taita", name: "Wakasigau", aka: "Kasigau", region: "Taita-Taveta (Voi)" },
  { community: "Taita", name: "Wataveta", region: "Taita-Taveta (Taveta)" },
];

// ---- Maasai — territorial sections (iloshon). ----
const MAASAI: Entry[] = [
  { community: "Maasai", name: "Ilkisonko", aka: "Kisongo", region: "Kajiado South" },
  { community: "Maasai", name: "Ilpurko", aka: "Purko", region: "Narok" },
  { community: "Maasai", name: "Iloitai", aka: "Loita", region: "Narok South" },
  { community: "Maasai", name: "Ildamat", region: "Kajiado / Narok" },
  { community: "Maasai", name: "Ilkeekonyokie", region: "Kajiado West / Narok East" },
  { community: "Maasai", name: "Ilmatapato", region: "Kajiado Central" },
  { community: "Maasai", name: "Ilkaputiei", region: "Kajiado East" },
  { community: "Maasai", name: "Ildalalekutuk", region: "Kajiado" },
  { community: "Maasai", name: "Iloodokilani", region: "Kajiado West" },
  { community: "Maasai", name: "Isiria", region: "Narok (Trans Mara)" },
  { community: "Maasai", name: "Moitanik", aka: "Uasin Gishu Maasai", region: "Narok" },
];

// ---- Samburu — the phratries / clans. ----
const SAMBURU: Entry[] = [
  { community: "Samburu", name: "Lmasula", region: "Samburu" },
  { community: "Samburu", name: "Lpisikishu", region: "Samburu" },
  { community: "Samburu", name: "Lukumai", region: "Samburu" },
  { community: "Samburu", name: "Lorokushu", region: "Samburu" },
  { community: "Samburu", name: "Longeli", region: "Samburu" },
  { community: "Samburu", name: "Lngwesi", region: "Samburu / Laikipia" },
];

// ---- Turkana — territorial sections. ----
const TURKANA: Entry[] = [
  { community: "Turkana", name: "Ngisonyoka", region: "Turkana South" },
  { community: "Turkana", name: "Ngibocheros", region: "Turkana Central" },
  { community: "Turkana", name: "Ngiyapakuno", region: "Turkana North" },
  { community: "Turkana", name: "Ngimonia", region: "Turkana" },
  { community: "Turkana", name: "Ngikamatak", region: "Turkana West" },
  { community: "Turkana", name: "Ngsiir", region: "Turkana" },
  { community: "Turkana", name: "Ngibelai", region: "Turkana" },
];

// ---- Somali (Kenyan) — major clan families. ----
const SOMALI: Entry[] = [
  { community: "Somali", name: "Ogaden", aka: "Darod", region: "Garissa" },
  { community: "Somali", name: "Degodia", aka: "Hawiye", region: "Wajir / Mandera" },
  { community: "Somali", name: "Garre", region: "Mandera" },
  { community: "Somali", name: "Murulle", region: "Mandera" },
  { community: "Somali", name: "Ajuran", region: "Wajir" },
  { community: "Somali", name: "Gurreh", region: "Mandera" },
  { community: "Somali", name: "Isaaq", region: "urban centres" },
  { community: "Somali", name: "Hawiye", region: "north eastern" },
];

// ---- Cushitic communities of northern Kenya. ----
const NORTHERN: Entry[] = [
  { community: "Borana", name: "Borana (Oromo)", region: "Marsabit / Isiolo" },
  { community: "Gabra", name: "Gabra", region: "Marsabit (North Horr)" },
  { community: "Rendille", name: "Rendille", region: "Marsabit (Laisamis)" },
  { community: "Burji", name: "Burji", region: "Marsabit / Moyale" },
  { community: "Sakuye", name: "Sakuye", region: "Marsabit / Isiolo" },
  { community: "Dassanach", name: "Dassanach", aka: "Merille", region: "Turkana (Ileret)" },
  { community: "El Molo", name: "El Molo", region: "Marsabit (Lake Turkana)" },
];

// ---- Other communities. ----
const OTHER: Entry[] = [
  { community: "Teso", name: "Iteso", region: "Busia (Teso North/South)" },
  { community: "Kuria", name: "Abakuria", region: "Migori" },
  { community: "Swahili", name: "Waswahili", region: "Coast (Mombasa, Lamu)" },
  { community: "Pokomo", name: "Wapokomo", region: "Tana River" },
  { community: "Orma", name: "Orma", region: "Tana River" },
  { community: "Taveta", name: "Wataveta", region: "Taita-Taveta (Taveta)" },
  { community: "Ogiek", name: "Ogiek", region: "Mau / Mt Elgon forests" },
  { community: "Sengwer", name: "Sengwer", region: "Cherangany Hills (Elgeyo-Marakwet / Trans-Nzoia)" },
  { community: "Nubian", name: "Nubi", region: "Nairobi (Kibra) / Kisumu" },
];

export const REFERENCE_CLAN_ROWS: Entry[] = [
  ...LUHYA,
  ...LUO,
  ...KIKUYU,
  ...KAMBA,
  ...KALENJIN,
  ...KISII,
  ...KURIA,
  ...MERU,
  ...EMBU,
  ...MIJIKENDA,
  ...TAITA,
  ...MAASAI,
  ...SAMBURU,
  ...TURKANA,
  ...SOMALI,
  ...NORTHERN,
  ...OTHER,
].map((e) => ({ ...e, notes: e.notes ?? SRC }));
