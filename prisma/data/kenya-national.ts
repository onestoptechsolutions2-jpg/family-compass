/**
 * National administrative units for place autocomplete — all 47 counties and
 * their 290 constituencies (used as the "sub-county" level), with wards where
 * they are well established. Western Kenya + Nyanza live in ./kenya-western and
 * are merged in at the end.
 *
 * This is a STARTER set to be corrected by families. Ward lists follow the 2013
 * IEBC delimitation; locations, sub-locations and villages are captured as
 * free text on the record itself and promoted from real usage over time.
 */
import { KENYA_LOCATION_ROWS as WESTERN_NYANZA } from "./kenya-western";

type Row = { region: string; county: string; subcounty: string; wards: string[] };

// ===================== NAIROBI =====================
const NAIROBI: Row[] = [
  { region: "Nairobi", county: "Nairobi", subcounty: "Westlands", wards: ["Kitisuru", "Parklands/Highridge", "Karura", "Kangemi", "Mountain View"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Dagoretti North", wards: ["Kilimani", "Kawangware", "Gatina", "Kileleshwa", "Kabiro"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Dagoretti South", wards: ["Mutu-ini", "Ngando", "Riruta", "Uthiru/Ruthimitu", "Waithaka"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Langata", wards: ["Karen", "Nairobi West", "Mugumo-ini", "South C", "Nyayo Highrise"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Kibra", wards: ["Laini Saba", "Lindi", "Makina", "Woodley/Kenyatta Golf Course", "Sarang'ombe"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Roysambu", wards: ["Githurai", "Kahawa West", "Zimmerman", "Roysambu", "Kahawa"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Kasarani", wards: ["Clay City", "Mwiki", "Kasarani", "Njiru", "Ruai"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Ruaraka", wards: ["Baba Dogo", "Utalii", "Mathare North", "Lucky Summer", "Korogocho"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Embakasi South", wards: ["Imara Daima", "Kwa Njenga", "Kwa Reuben", "Pipeline", "Kware"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Embakasi North", wards: ["Kariobangi North", "Dandora Area I", "Dandora Area II", "Dandora Area III", "Dandora Area IV"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Embakasi Central", wards: ["Kayole North", "Kayole Central", "Kayole South", "Komarock", "Matopeni/Spring Valley"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Embakasi East", wards: ["Upper Savanna", "Lower Savanna", "Embakasi", "Utawala", "Mihang'o"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Embakasi West", wards: ["Umoja I", "Umoja II", "Mowlem", "Kariobangi South"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Makadara", wards: ["Maringo/Hamza", "Viwandani", "Harambee", "Makongeni"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Kamukunji", wards: ["Pumwani", "Eastleigh North", "Eastleigh South", "Airbase", "California"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Starehe", wards: ["Nairobi Central", "Ngara", "Ziwani/Kariokor", "Pangani", "Landimawe", "Nairobi South"] },
  { region: "Nairobi", county: "Nairobi", subcounty: "Mathare", wards: ["Hospital", "Mabatini", "Huruma", "Ngei", "Mlango Kubwa", "Kiamaiko"] },
];

// ===================== CENTRAL =====================
const CENTRAL: Row[] = [
  { region: "Central", county: "Kiambu", subcounty: "Gatundu South", wards: ["Kiamwangi", "Kiganjo", "Ndarugu", "Ngenda"] },
  { region: "Central", county: "Kiambu", subcounty: "Gatundu North", wards: ["Gituamba", "Githobokoni", "Chania", "Mang'u"] },
  { region: "Central", county: "Kiambu", subcounty: "Juja", wards: ["Murera", "Theta", "Juja", "Witeithie", "Kalimoni"] },
  { region: "Central", county: "Kiambu", subcounty: "Thika Town", wards: ["Township", "Kamenu", "Hospital", "Gatuanyaga", "Ngoliba"] },
  { region: "Central", county: "Kiambu", subcounty: "Ruiru", wards: ["Gitothua", "Biashara", "Gatongora", "Kahawa Sukari", "Kahawa Wendani", "Kiuu", "Mwiki", "Mwihoko"] },
  { region: "Central", county: "Kiambu", subcounty: "Githunguri", wards: ["Githunguri", "Githiga", "Ikinu", "Ngewa", "Komothai"] },
  { region: "Central", county: "Kiambu", subcounty: "Kiambu", wards: ["Ting'ang'a", "Ndumberi", "Riabai", "Township"] },
  { region: "Central", county: "Kiambu", subcounty: "Kiambaa", wards: ["Cianda", "Karuri", "Ndenderu", "Muchatha", "Kihara"] },
  { region: "Central", county: "Kiambu", subcounty: "Kabete", wards: ["Gitaru", "Muguga", "Nyadhuna", "Kabete", "Uthiru"] },
  { region: "Central", county: "Kiambu", subcounty: "Kikuyu", wards: ["Karai", "Nachu", "Sigona", "Kikuyu", "Kinoo"] },
  { region: "Central", county: "Kiambu", subcounty: "Limuru", wards: ["Bibirioni", "Limuru Central", "Ndeiya", "Limuru East", "Ngecha Tigoni"] },
  { region: "Central", county: "Kiambu", subcounty: "Lari", wards: ["Kinale", "Kijabe", "Nyanduma", "Kamburu", "Lari/Kirenga"] },

  { region: "Central", county: "Murang'a", subcounty: "Kangema", wards: ["Kanyenya-ini", "Muguru", "Rwathia"] },
  { region: "Central", county: "Murang'a", subcounty: "Mathioya", wards: ["Gitugi", "Kiru", "Kamacharia"] },
  { region: "Central", county: "Murang'a", subcounty: "Kiharu", wards: ["Wangu", "Mugoiri", "Mbiri", "Township", "Murarandia", "Gaturi"] },
  { region: "Central", county: "Murang'a", subcounty: "Kigumo", wards: ["Kahumbu", "Muthithi", "Kigumo", "Kangari", "Kinyona"] },
  { region: "Central", county: "Murang'a", subcounty: "Maragwa", wards: ["Kimorori/Wempa", "Makuyu", "Kambiti", "Kamahuha", "Ichagaki", "Nginda"] },
  { region: "Central", county: "Murang'a", subcounty: "Kandara", wards: ["Ng'araria", "Muruka", "Kagundu-ini", "Gaichanjiru", "Ithiru", "Ruchu"] },
  { region: "Central", county: "Murang'a", subcounty: "Gatanga", wards: ["Ithanga", "Kakuzi/Mitubiri", "Mugumo-ini", "Kihumbu-ini", "Gatanga", "Kariara"] },

  { region: "Central", county: "Nyeri", subcounty: "Tetu", wards: ["Dedan Kimathi", "Wamagana", "Aguthi-Gaaki"] },
  { region: "Central", county: "Nyeri", subcounty: "Kieni", wards: ["Mweiga", "Naromoru Kiamathaga", "Mwiyogo/Endarasha", "Mugunda", "Gatarakwa", "Thegu River", "Kabaru", "Gakawa"] },
  { region: "Central", county: "Nyeri", subcounty: "Mathira", wards: ["Ruguru", "Magutu", "Iriaini", "Konyu", "Kirimukuyu", "Karatina Town"] },
  { region: "Central", county: "Nyeri", subcounty: "Othaya", wards: ["Mahiga", "Iria-ini", "Chinga", "Karima"] },
  { region: "Central", county: "Nyeri", subcounty: "Mukurweini", wards: ["Gikondi", "Rugi", "Mukurwe-ini West", "Mukurwe-ini Central"] },
  { region: "Central", county: "Nyeri", subcounty: "Nyeri Town", wards: ["Kiganjo/Mathari", "Rware", "Gatitu/Muruguru", "Ruring'u", "Kamakwa/Mukaro"] },

  { region: "Central", county: "Kirinyaga", subcounty: "Mwea", wards: ["Mutithi", "Kangai", "Thiba", "Wamumu", "Nyangati", "Murinduko", "Gathigiriri", "Tebere"] },
  { region: "Central", county: "Kirinyaga", subcounty: "Gichugu", wards: ["Kabare", "Baragwi", "Njukiini", "Ngariama", "Karumandi"] },
  { region: "Central", county: "Kirinyaga", subcounty: "Ndia", wards: ["Mukure", "Kiine", "Kariti"] },
  { region: "Central", county: "Kirinyaga", subcounty: "Kirinyaga Central", wards: ["Mutira", "Kanyekini", "Kerugoya", "Inoi"] },

  { region: "Central", county: "Nyandarua", subcounty: "Kinangop", wards: ["Engineer", "Gathara", "North Kinangop", "Murungaru", "Njabini/Kiburu", "Nyakio", "Githabai", "Magumu"] },
  { region: "Central", county: "Nyandarua", subcounty: "Kipipiri", wards: ["Wanjohi", "Kipipiri", "Geta", "Githioro"] },
  { region: "Central", county: "Nyandarua", subcounty: "Ol Kalou", wards: ["Karau", "Kanjuiri Range", "Mirangine", "Kaimbaga", "Rurii"] },
  { region: "Central", county: "Nyandarua", subcounty: "Ol Jorok", wards: ["Gathanji", "Gatimu", "Weru", "Charagita"] },
  { region: "Central", county: "Nyandarua", subcounty: "Ndaragwa", wards: ["Leshau/Pondo", "Kiriita", "Central", "Shamata"] },
];

// ===================== COAST =====================
const COAST: Row[] = [
  { region: "Coast", county: "Mombasa", subcounty: "Changamwe", wards: ["Port Reitz", "Kipevu", "Airport", "Changamwe", "Chaani"] },
  { region: "Coast", county: "Mombasa", subcounty: "Jomvu", wards: ["Jomvu Kuu", "Miritini", "Mikindani"] },
  { region: "Coast", county: "Mombasa", subcounty: "Kisauni", wards: ["Mjambere", "Junda", "Bamburi", "Mwakirunge", "Mtopanga", "Magogoni", "Shanzu"] },
  { region: "Coast", county: "Mombasa", subcounty: "Nyali", wards: ["Frere Town", "Ziwa la Ng'ombe", "Mkomani", "Kongowea", "Kadzandani"] },
  { region: "Coast", county: "Mombasa", subcounty: "Likoni", wards: ["Mtongwe", "Shika Adabu", "Bofu", "Likoni", "Timbwani"] },
  { region: "Coast", county: "Mombasa", subcounty: "Mvita", wards: ["Mji wa Kale/Makadara", "Tudor", "Tononoka", "Shimanzi/Ganjoni", "Majengo"] },

  { region: "Coast", county: "Kwale", subcounty: "Msambweni", wards: ["Gombato Bongwe", "Ukunda", "Kinondo", "Ramisi"] },
  { region: "Coast", county: "Kwale", subcounty: "Lungalunga", wards: ["Pongwe/Kikoneni", "Dzombo", "Mwereni", "Vanga"] },
  { region: "Coast", county: "Kwale", subcounty: "Matuga", wards: ["Tsimba Golini", "Waa", "Tiwi", "Kubo South", "Mkongani"] },
  { region: "Coast", county: "Kwale", subcounty: "Kinango", wards: ["Ndavaya", "Puma", "Kinango", "Mackinnon Road", "Chengoni/Samburu", "Mwavumbo", "Kasemeni"] },

  { region: "Coast", county: "Kilifi", subcounty: "Kilifi North", wards: ["Tezo", "Sokoni", "Kibarani", "Dabaso", "Matsangoni", "Watamu", "Mnarani"] },
  { region: "Coast", county: "Kilifi", subcounty: "Kilifi South", wards: ["Junju", "Mwarakaya", "Shimo la Tewa", "Chasimba", "Mtepeni"] },
  { region: "Coast", county: "Kilifi", subcounty: "Kaloleni", wards: ["Mariakani", "Kayafungo", "Kaloleni", "Mwanamwinga"] },
  { region: "Coast", county: "Kilifi", subcounty: "Rabai", wards: ["Mwawesa", "Ruruma", "Kambe/Ribe", "Rabai/Kisurutini"] },
  { region: "Coast", county: "Kilifi", subcounty: "Ganze", wards: ["Ganze", "Bamba", "Jaribuni", "Sokoke"] },
  { region: "Coast", county: "Kilifi", subcounty: "Malindi", wards: ["Jilore", "Kakuyuni", "Ganda", "Malindi Town", "Shella"] },
  { region: "Coast", county: "Kilifi", subcounty: "Magarini", wards: ["Marafa", "Magarini", "Gongoni", "Adu", "Garashi", "Sabaki"] },

  { region: "Coast", county: "Tana River", subcounty: "Garsen", wards: ["Kipini East", "Garsen South", "Kipini West", "Garsen Central", "Garsen West", "Garsen North"] },
  { region: "Coast", county: "Tana River", subcounty: "Galole", wards: ["Kinakomba", "Mikinduni", "Chewani", "Wayu"] },
  { region: "Coast", county: "Tana River", subcounty: "Bura", wards: ["Chewele", "Hirimani", "Bangale", "Sala", "Madogo"] },

  { region: "Coast", county: "Lamu", subcounty: "Lamu East", wards: ["Faza", "Kiunga", "Basuba"] },
  { region: "Coast", county: "Lamu", subcounty: "Lamu West", wards: ["Shella", "Mkomani", "Hindi", "Mkunumbi", "Hongwe", "Witu", "Bahari"] },

  { region: "Coast", county: "Taita-Taveta", subcounty: "Taveta", wards: ["Chala", "Mahoo", "Bomeni", "Mboghoni", "Mata"] },
  { region: "Coast", county: "Taita-Taveta", subcounty: "Wundanyi", wards: ["Wundanyi/Mbale", "Werugha", "Wumingu/Kishushe", "Mwanda/Mgange"] },
  { region: "Coast", county: "Taita-Taveta", subcounty: "Mwatate", wards: ["Ronge", "Mwatate", "Bura", "Chawia", "Wusi/Kishamba"] },
  { region: "Coast", county: "Taita-Taveta", subcounty: "Voi", wards: ["Mbololo", "Sagalla", "Kaloleni", "Marungu", "Kasigau", "Ngolia"] },
];

// ===================== EASTERN =====================
const EASTERN: Row[] = [
  { region: "Eastern", county: "Machakos", subcounty: "Machakos Town", wards: ["Kalama", "Mua", "Mumbuni North", "Machakos Central", "Mumbuni South", "Muvuti/Kiima-Kimwe", "Kola"] },
  { region: "Eastern", county: "Machakos", subcounty: "Mavoko", wards: ["Athi River", "Kinanie", "Muthwani", "Syokimau/Mulolongo"] },
  { region: "Eastern", county: "Machakos", subcounty: "Kathiani", wards: ["Mitaboni", "Kathiani Central", "Upper Kaewa/Iveti", "Lower Kaewa/Kaani"] },
  { region: "Eastern", county: "Machakos", subcounty: "Masinga", wards: ["Kivaa", "Masinga Central", "Ekalakala", "Muthesya", "Ndithini"] },
  { region: "Eastern", county: "Machakos", subcounty: "Yatta", wards: ["Ndalani", "Matuu", "Kithimani", "Ikombe", "Katangi"] },
  { region: "Eastern", county: "Machakos", subcounty: "Kangundo", wards: ["Kangundo North", "Kangundo Central", "Kangundo East", "Kangundo West"] },
  { region: "Eastern", county: "Machakos", subcounty: "Matungulu", wards: ["Tala", "Matungulu North", "Matungulu East", "Matungulu West", "Kyeleni"] },
  { region: "Eastern", county: "Machakos", subcounty: "Mwala", wards: ["Mbiuni", "Makutano/Mwala", "Masii", "Muthetheni", "Wamunyu", "Kibauni"] },

  { region: "Eastern", county: "Makueni", subcounty: "Mbooni", wards: ["Tulimani", "Mbooni", "Kithungo/Kitundu", "Kiteta/Kisau", "Waia/Kako", "Kalawa"] },
  { region: "Eastern", county: "Makueni", subcounty: "Kilome", wards: ["Kasikeu", "Mukaa", "Kiima Kiu/Kalanzoni"] },
  { region: "Eastern", county: "Makueni", subcounty: "Kaiti", wards: ["Ukia", "Kee", "Kilungu", "Ilima"] },
  { region: "Eastern", county: "Makueni", subcounty: "Makueni", wards: ["Wote", "Muvau/Kikuumini", "Mavindini", "Kitise/Kithuki", "Kathonzweni", "Nzaui/Kilili/Kalamba", "Mbitini"] },
  { region: "Eastern", county: "Makueni", subcounty: "Kibwezi West", wards: ["Makindu", "Nguumo", "Kikumbulyu North", "Kikumbulyu South", "Nguu/Masumba", "Emali/Mulala"] },
  { region: "Eastern", county: "Makueni", subcounty: "Kibwezi East", wards: ["Masongaleni", "Mtito Andei", "Thange", "Ivingoni/Nzambani"] },

  { region: "Eastern", county: "Kitui", subcounty: "Mwingi North", wards: ["Ngomeni", "Kyuso", "Mumoni", "Tseikuru", "Tharaka"] },
  { region: "Eastern", county: "Kitui", subcounty: "Mwingi West", wards: ["Kyome/Thaana", "Nguutani", "Migwani", "Kiomo/Kyethani"] },
  { region: "Eastern", county: "Kitui", subcounty: "Mwingi Central", wards: ["Central", "Kivou", "Nguni", "Nuu", "Mui", "Waita"] },
  { region: "Eastern", county: "Kitui", subcounty: "Kitui West", wards: ["Mutonguni", "Kauwi", "Matinyani", "Kwa Mutonga/Kithumula"] },
  { region: "Eastern", county: "Kitui", subcounty: "Kitui Rural", wards: ["Kisasi", "Mbitini", "Kwavonza/Yatta", "Kanyangi"] },
  { region: "Eastern", county: "Kitui", subcounty: "Kitui Central", wards: ["Miambani", "Township", "Kyangwithya West", "Mulango", "Kyangwithya East"] },
  { region: "Eastern", county: "Kitui", subcounty: "Kitui East", wards: ["Zombe/Mwitika", "Nzambani", "Chuluni", "Voo/Kyamatu", "Endau/Malalani", "Mutito/Kaliku"] },
  { region: "Eastern", county: "Kitui", subcounty: "Kitui South", wards: ["Ikanga/Kyatune", "Mutomo", "Mutha", "Ikutha", "Kanziko", "Athi"] },

  { region: "Eastern", county: "Embu", subcounty: "Manyatta", wards: ["Ruguru/Ngandori", "Kithimu", "Nginda", "Mbeti North", "Kirimari", "Gaturi South"] },
  { region: "Eastern", county: "Embu", subcounty: "Runyenjes", wards: ["Gaturi North", "Kagaari South", "Central Ward", "Kagaari North", "Kyeni North", "Kyeni South"] },
  { region: "Eastern", county: "Embu", subcounty: "Mbeere South", wards: ["Mwea", "Makima", "Mbeti South", "Mavuria", "Kiambere"] },
  { region: "Eastern", county: "Embu", subcounty: "Mbeere North", wards: ["Nthawa", "Muminji", "Evurore"] },

  { region: "Eastern", county: "Tharaka-Nithi", subcounty: "Maara", wards: ["Mitheru", "Muthambi", "Mwimbi", "Ganga", "Chogoria"] },
  { region: "Eastern", county: "Tharaka-Nithi", subcounty: "Chuka/Igambang'ombe", wards: ["Mariani", "Karingani", "Magumoni", "Mugwe", "Igambang'ombe"] },
  { region: "Eastern", county: "Tharaka-Nithi", subcounty: "Tharaka", wards: ["Gatunga", "Mukothima", "Nkondi", "Chiakariga", "Marimanti"] },

  { region: "Eastern", county: "Meru", subcounty: "Igembe South", wards: ["Maua", "Kiegoi/Antubochiu", "Athiru Gaiti", "Akachiu", "Kanuni"] },
  { region: "Eastern", county: "Meru", subcounty: "Igembe Central", wards: ["Akirang'ondu", "Athiru Ruujine", "Igembe East", "Njia", "Kangeta"] },
  { region: "Eastern", county: "Meru", subcounty: "Igembe North", wards: ["Antuambui", "Ntunene", "Antubetwe Kiongo", "Naathu", "Amwathi"] },
  { region: "Eastern", county: "Meru", subcounty: "Tigania West", wards: ["Athwana", "Akithii", "Kianjai", "Nkomo", "Mbeu"] },
  { region: "Eastern", county: "Meru", subcounty: "Tigania East", wards: ["Thangatha", "Mikinduri", "Kiguchwa", "Muthara", "Karama"] },
  { region: "Eastern", county: "Meru", subcounty: "North Imenti", wards: ["Municipality", "Ntima East", "Ntima West", "Nyaki West", "Nyaki East"] },
  { region: "Eastern", county: "Meru", subcounty: "Buuri", wards: ["Timau", "Kisima", "Kiirua/Naari", "Ruiri/Rwarera", "Kibirichia"] },
  { region: "Eastern", county: "Meru", subcounty: "Central Imenti", wards: ["Mwanganthia", "Abothuguchi Central", "Abothuguchi West", "Kiagu"] },
  { region: "Eastern", county: "Meru", subcounty: "South Imenti", wards: ["Mitunguu", "Igoji East", "Igoji West", "Abogeta East", "Abogeta West", "Nkuene"] },

  { region: "Eastern", county: "Isiolo", subcounty: "Isiolo North", wards: ["Wabera", "Bulla Pesa", "Chari", "Cherab", "Ngare Mara", "Burat", "Oldonyiro"] },
  { region: "Eastern", county: "Isiolo", subcounty: "Isiolo South", wards: ["Garbatulla", "Kinna", "Sericho"] },

  { region: "Eastern", county: "Marsabit", subcounty: "Moyale", wards: ["Butiye", "Sololo", "Heillu/Manyatta", "Golbo", "Moyale Township", "Uran", "Obbu"] },
  { region: "Eastern", county: "Marsabit", subcounty: "North Horr", wards: ["Dukana", "Maikona", "Turbi", "North Horr", "Illeret"] },
  { region: "Eastern", county: "Marsabit", subcounty: "Saku", wards: ["Sagante/Jaldesa", "Karare", "Marsabit Central"] },
  { region: "Eastern", county: "Marsabit", subcounty: "Laisamis", wards: ["Loiyangalani", "Kargi/South Horr", "Korr/Ngurunit", "Log Logo", "Laisamis"] },
];

// ===================== NORTH EASTERN =====================
const NORTH_EASTERN: Row[] = [
  { region: "North Eastern", county: "Garissa", subcounty: "Garissa Township", wards: ["Waberi", "Galbet", "Township", "Iftin"] },
  { region: "North Eastern", county: "Garissa", subcounty: "Balambala", wards: ["Balambala", "Danyere", "Jara Jara", "Saka", "Sankuri"] },
  { region: "North Eastern", county: "Garissa", subcounty: "Lagdera", wards: ["Modogashe", "Benane", "Goreale", "Maalimin", "Sabena", "Baraki"] },
  { region: "North Eastern", county: "Garissa", subcounty: "Dadaab", wards: ["Dertu", "Dadaab", "Labai", "Damajale", "Liboi", "Abakaile"] },
  { region: "North Eastern", county: "Garissa", subcounty: "Fafi", wards: ["Bura", "Dekaharia", "Jarajila", "Fafi", "Nanighi"] },
  { region: "North Eastern", county: "Garissa", subcounty: "Ijara", wards: ["Hulugho", "Sangailu", "Ijara", "Masalani"] },

  { region: "North Eastern", county: "Wajir", subcounty: "Wajir North", wards: ["Gurar", "Bute", "Korondile", "Malkagufu", "Batalu", "Danaba", "Godoma"] },
  { region: "North Eastern", county: "Wajir", subcounty: "Wajir East", wards: ["Wagberi", "Township", "Barwaqo", "Khorof/Harar"] },
  { region: "North Eastern", county: "Wajir", subcounty: "Tarbaj", wards: ["Elben", "Sarman", "Tarbaj", "Wargadud"] },
  { region: "North Eastern", county: "Wajir", subcounty: "Wajir West", wards: ["Arbajahan", "Hadado/Athibohol", "Ademasajide", "Wagalla/Ganyure"] },
  { region: "North Eastern", county: "Wajir", subcounty: "Eldas", wards: ["Eldas", "Della", "Lakoley South/Basir", "Elnur/Tula Tula"] },
  { region: "North Eastern", county: "Wajir", subcounty: "Wajir South", wards: ["Benane", "Burder", "Dadaja Bula", "Habaswein", "Lagboghol South", "Ibrahim Ure", "Diif"] },

  { region: "North Eastern", county: "Mandera", subcounty: "Mandera West", wards: ["Takaba South", "Takaba", "Lag Sure", "Dandu", "Gither"] },
  { region: "North Eastern", county: "Mandera", subcounty: "Banissa", wards: ["Banissa", "Derkhale", "Guba", "Malkamari", "Kiliwehiri"] },
  { region: "North Eastern", county: "Mandera", subcounty: "Mandera North", wards: ["Ashabito", "Guticha", "Morothile", "Rhamu", "Rhamu Dimtu"] },
  { region: "North Eastern", county: "Mandera", subcounty: "Mandera South", wards: ["Wargadud", "Kutulo", "Elwak South", "Elwak North", "Shimbir Fatuma"] },
  { region: "North Eastern", county: "Mandera", subcounty: "Mandera East", wards: ["Arabia", "Township", "Neboi", "Khalalio", "Libehia"] },
  { region: "North Eastern", county: "Mandera", subcounty: "Lafey", wards: ["Sala", "Fino", "Lafey", "Warankara", "Alango Gof"] },
];

// ===================== RIFT VALLEY =====================
const RIFT_VALLEY: Row[] = [
  { region: "Rift Valley", county: "Turkana", subcounty: "Turkana North", wards: ["Kaeris", "Lake Zone", "Lapur", "Kaaleng/Kaikor", "Kibish", "Nakalale"] },
  { region: "Rift Valley", county: "Turkana", subcounty: "Turkana West", wards: ["Kakuma", "Lopur", "Letea", "Songot", "Kalobeyei", "Lokichoggio", "Nanaam"] },
  { region: "Rift Valley", county: "Turkana", subcounty: "Turkana Central", wards: ["Kerio Delta", "Kang'atotha", "Kalokol", "Lodwar Township", "Kanamkemer"] },
  { region: "Rift Valley", county: "Turkana", subcounty: "Loima", wards: ["Kotaruk/Lobei", "Turkwel", "Loima", "Lokiriama/Lorengippi"] },
  { region: "Rift Valley", county: "Turkana", subcounty: "Turkana South", wards: ["Kaputir", "Katilu", "Lobokat", "Kalapata", "Lokichar"] },
  { region: "Rift Valley", county: "Turkana", subcounty: "Turkana East", wards: ["Kapedo/Napeitom", "Katilia", "Lokori/Kochodin"] },

  { region: "Rift Valley", county: "West Pokot", subcounty: "Kapenguria", wards: ["Riwo", "Kapenguria", "Mnagei", "Siyoi", "Endugh", "Sook"] },
  { region: "Rift Valley", county: "West Pokot", subcounty: "Sigor", wards: ["Sekerr", "Masool", "Lomut", "Weiwei"] },
  { region: "Rift Valley", county: "West Pokot", subcounty: "Kacheliba", wards: ["Suam", "Kodich", "Kasei", "Kapchok", "Kiwawa", "Alale"] },
  { region: "Rift Valley", county: "West Pokot", subcounty: "Pokot South", wards: ["Chepareria", "Batei", "Lelan", "Tapach"] },

  { region: "Rift Valley", county: "Samburu", subcounty: "Samburu West", wards: ["Lodokejek", "Suguta Marmar", "Maralal", "Loosuk", "Poro"] },
  { region: "Rift Valley", county: "Samburu", subcounty: "Samburu North", wards: ["El-Barta", "Nachola", "Ndoto", "Nyiro", "Angata Nanyokie", "Baawa"] },
  { region: "Rift Valley", county: "Samburu", subcounty: "Samburu East", wards: ["Waso", "Wamba West", "Wamba East", "Wamba North"] },

  { region: "Rift Valley", county: "Baringo", subcounty: "Tiaty", wards: ["Tirioko", "Kolowa", "Ribkwo", "Silale", "Loiyamorock", "Tangulbei/Korossi", "Churo/Amaya"] },
  { region: "Rift Valley", county: "Baringo", subcounty: "Baringo North", wards: ["Barwessa", "Kabartonjo", "Saimo/Kipsaraman", "Saimo/Soi", "Bartabwa"] },
  { region: "Rift Valley", county: "Baringo", subcounty: "Baringo Central", wards: ["Kabarnet", "Sacho", "Tenges", "Ewalel/Chapchap", "Kapropita"] },
  { region: "Rift Valley", county: "Baringo", subcounty: "Baringo South", wards: ["Marigat", "Ilchamus", "Mochongoi", "Mukutani"] },
  { region: "Rift Valley", county: "Baringo", subcounty: "Mogotio", wards: ["Mogotio", "Emining", "Kisanana"] },
  { region: "Rift Valley", county: "Baringo", subcounty: "Eldama Ravine", wards: ["Lembus", "Lembus Kwen", "Ravine", "Mumberes/Maji Mazuri", "Lembus/Perkerra", "Koibatek"] },

  { region: "Rift Valley", county: "Laikipia", subcounty: "Laikipia West", wards: ["Ol Moran", "Rumuruti Township", "Githiga", "Marmanet", "Igwamiti", "Salama"] },
  { region: "Rift Valley", county: "Laikipia", subcounty: "Laikipia East", wards: ["Ngobit", "Tigithi", "Thingithu", "Nanyuki", "Umande"] },
  { region: "Rift Valley", county: "Laikipia", subcounty: "Laikipia North", wards: ["Sosian", "Segera", "Mukogodo East", "Mukogodo West"] },

  { region: "Rift Valley", county: "Nakuru", subcounty: "Molo", wards: ["Mariashoni", "Elburgon", "Turi", "Molo"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Njoro", wards: ["Mau Narok", "Mauche", "Kihingo", "Nessuit", "Lare", "Njoro"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Naivasha", wards: ["Biashara", "Hells Gate", "Lakeview", "Maiella", "Mai Mahiu", "Olkaria", "Naivasha East", "Viwandani"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Gilgil", wards: ["Gilgil", "Elementaita", "Mbaruk/Eburu", "Malewa West", "Murindati"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Kuresoi South", wards: ["Amalo", "Keringet", "Kiptagich", "Tinet"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Kuresoi North", wards: ["Kiptororo", "Nyota", "Sirikwa", "Kamara"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Subukia", wards: ["Subukia", "Waseges", "Kabazi"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Rongai", wards: ["Menengai West", "Soin", "Visoi", "Mosop", "Solai"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Bahati", wards: ["Dundori", "Kabatini", "Kiamaina", "Lanet/Umoja", "Bahati"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Nakuru Town West", wards: ["Barut", "London", "Kaptembwo", "Kapkures", "Rhoda", "Shabab"] },
  { region: "Rift Valley", county: "Nakuru", subcounty: "Nakuru Town East", wards: ["Biashara", "Kivumbini", "Flamingo", "Menengai", "Nakuru East"] },

  { region: "Rift Valley", county: "Narok", subcounty: "Kilgoris", wards: ["Kilgoris Central", "Keyian", "Angata Barikoi", "Shankoe", "Kimintet", "Lolgorian"] },
  { region: "Rift Valley", county: "Narok", subcounty: "Emurua Dikirr", wards: ["Ilkerin", "Ololmasani", "Mogondo", "Kapsasian"] },
  { region: "Rift Valley", county: "Narok", subcounty: "Narok North", wards: ["Olpusimoru", "Olokurto", "Narok Town", "Nkareta", "Olorropil", "Melili"] },
  { region: "Rift Valley", county: "Narok", subcounty: "Narok East", wards: ["Mosiro", "Ildamat", "Keekonyokie", "Suswa"] },
  { region: "Rift Valley", county: "Narok", subcounty: "Narok South", wards: ["Majimoto/Naroosura", "Ololulung'a", "Melelo", "Loita", "Sogoo", "Sagamian"] },
  { region: "Rift Valley", county: "Narok", subcounty: "Narok West", wards: ["Ilmotiok", "Mara", "Siana", "Naikarra"] },

  { region: "Rift Valley", county: "Kajiado", subcounty: "Kajiado North", wards: ["Olkeri", "Ongata Rongai", "Nkaimurunya", "Oloolua", "Ngong"] },
  { region: "Rift Valley", county: "Kajiado", subcounty: "Kajiado Central", wards: ["Purko", "Ildamat", "Dalalekutuk", "Matapato North", "Matapato South"] },
  { region: "Rift Valley", county: "Kajiado", subcounty: "Kajiado East", wards: ["Kaputiei North", "Kitengela", "Oloosirkon/Sholinke", "Kenyawa-Poka", "Imaroro"] },
  { region: "Rift Valley", county: "Kajiado", subcounty: "Kajiado West", wards: ["Keekonyokie", "Iloodokilani", "Magadi", "Ewuaso Oo Nkidong'i", "Mosiro"] },
  { region: "Rift Valley", county: "Kajiado", subcounty: "Kajiado South", wards: ["Entonet/Lenkisim", "Mbirikani/Eselenkei", "Kuku", "Rombo", "Kimana"] },

  { region: "Rift Valley", county: "Kericho", subcounty: "Kipkelion East", wards: ["Londiani", "Kedowa/Kimugul", "Chepseon", "Tendeno/Sorget"] },
  { region: "Rift Valley", county: "Kericho", subcounty: "Kipkelion West", wards: ["Kunyak", "Kamasian", "Kipkelion", "Chilchila"] },
  { region: "Rift Valley", county: "Kericho", subcounty: "Ainamoi", wards: ["Kapsoit", "Ainamoi", "Kapkugerwet", "Kipchebor", "Kipchimchim", "Kapsaos"] },
  { region: "Rift Valley", county: "Kericho", subcounty: "Bureti", wards: ["Kisiara", "Tebesonik", "Cheboin", "Chemosot", "Litein", "Cheplanget", "Kapkatet"] },
  { region: "Rift Valley", county: "Kericho", subcounty: "Belgut", wards: ["Waldai", "Kabianga", "Cheptororiet/Seretut", "Chaik", "Kapsuser"] },
  { region: "Rift Valley", county: "Kericho", subcounty: "Sigowet/Soin", wards: ["Sigowet", "Kaplelartet", "Soliat", "Soin"] },

  { region: "Rift Valley", county: "Bomet", subcounty: "Sotik", wards: ["Ndanai/Abosi", "Chemagel", "Kipsonoi", "Kapletundo", "Rongena/Manaret"] },
  { region: "Rift Valley", county: "Bomet", subcounty: "Chepalungu", wards: ["Kong'asis", "Nyongores", "Sigor", "Chebunyo", "Siongiroi"] },
  { region: "Rift Valley", county: "Bomet", subcounty: "Bomet East", wards: ["Merigi", "Kembu", "Longisa", "Kipreres", "Chemaner"] },
  { region: "Rift Valley", county: "Bomet", subcounty: "Bomet Central", wards: ["Silibwet Township", "Ndaraweta", "Singorwet", "Chesoen", "Mutarakwa"] },
  { region: "Rift Valley", county: "Bomet", subcounty: "Konoin", wards: ["Chepchabas", "Kimulot", "Mogogosiek", "Boito", "Embomos"] },

  { region: "Rift Valley", county: "Nandi", subcounty: "Tinderet", wards: ["Songhor/Soba", "Tindiret", "Chemelil/Chemase", "Kapsimotwo"] },
  { region: "Rift Valley", county: "Nandi", subcounty: "Aldai", wards: ["Kabwareng", "Terik", "Kemeloi-Maraba", "Kobujoi", "Kaptumo-Kaboi", "Koyo-Ndurio"] },
  { region: "Rift Valley", county: "Nandi", subcounty: "Nandi Hills", wards: ["Nandi Hills", "Chepkunyuk", "Ol'lessos", "Kapchorua"] },
  { region: "Rift Valley", county: "Nandi", subcounty: "Chesumei", wards: ["Chemundu/Kapng'etuny", "Kosirai", "Lelmokwo/Ngechek", "Kaptel/Kamoiywo", "Kiptuya"] },
  { region: "Rift Valley", county: "Nandi", subcounty: "Emgwen", wards: ["Chepkumia", "Kapkangani", "Kapsabet", "Kilibwoni"] },
  { region: "Rift Valley", county: "Nandi", subcounty: "Mosop", wards: ["Chepterwai", "Kipkaren", "Kurgung/Surungai", "Kabiyet", "Ndalat", "Kabisaga", "Sangalo/Kebulonik"] },

  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Soy", wards: ["Moi's Bridge", "Kapkures", "Ziwa", "Segero/Barsombe", "Kipsomba", "Soy", "Kuinet/Kapsuswa"] },
  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Turbo", wards: ["Ngenyilel", "Tapsagoi", "Kamagut", "Kiplombe", "Kapsaos", "Huruma"] },
  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Moiben", wards: ["Tembelio", "Sergoit", "Karuna/Meibeki", "Moiben", "Kimumu"] },
  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Ainabkoi", wards: ["Kapsoya", "Kaptagat", "Ainabkoi/Olare"] },
  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Kapseret", wards: ["Simat/Kapseret", "Kipkenyo", "Ngeria", "Megun", "Langas"] },
  { region: "Rift Valley", county: "Uasin Gishu", subcounty: "Kesses", wards: ["Racecourse", "Cheptiret/Kipchamo", "Tulwet/Chuiyat", "Tarakwa"] },

  { region: "Rift Valley", county: "Elgeyo-Marakwet", subcounty: "Marakwet East", wards: ["Kapyego", "Sambirir", "Endo", "Embobut/Embulot"] },
  { region: "Rift Valley", county: "Elgeyo-Marakwet", subcounty: "Marakwet West", wards: ["Lelan", "Sengwer", "Cherang'any/Chebororwa", "Moiben/Kuserwo", "Kapsowar", "Arror"] },
  { region: "Rift Valley", county: "Elgeyo-Marakwet", subcounty: "Keiyo North", wards: ["Emsoo", "Kamariny", "Kapchemutwa", "Tambach"] },
  { region: "Rift Valley", county: "Elgeyo-Marakwet", subcounty: "Keiyo South", wards: ["Kaptarakwa", "Chepkorio", "Soy North", "Soy South", "Kabiemit", "Metkei"] },
];

const NATIONAL: Row[] = [
  ...NAIROBI,
  ...CENTRAL,
  ...COAST,
  ...EASTERN,
  ...NORTH_EASTERN,
  ...RIFT_VALLEY,
];

/** Every province, merged. Western Kenya + Nyanza come from ./kenya-western. */
export const KENYA_ALL_ROWS = [...NATIONAL, ...WESTERN_NYANZA];
