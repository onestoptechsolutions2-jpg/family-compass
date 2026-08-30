/** Starter administrative units for place autocomplete — Western Kenya (Luhya
 *  region) first, then Nyanza. County > Sub-county > Ward. Not exhaustive;
 *  extend over time. Villages are captured free-text on the record itself. */

type Row = { region: string; county: string; subcounty: string; wards: string[] };

const WESTERN: Row[] = [
  // ---- Kakamega ----
  { region: "Western", county: "Kakamega", subcounty: "Lurambi", wards: ["Butsotso East", "Butsotso South", "Butsotso Central", "Sheywe", "Mahiakalo", "Shirere"] },
  { region: "Western", county: "Kakamega", subcounty: "Mumias East", wards: ["Lusheya/Lubinu", "Malaha/Isongo/Makunga", "East Wanga"] },
  { region: "Western", county: "Kakamega", subcounty: "Mumias West", wards: ["Mumias Central", "Mumias North", "Etenje", "Musanda"] },
  { region: "Western", county: "Kakamega", subcounty: "Matungu", wards: ["Koyonzo", "Kholera", "Khalaba", "Mayoni", "Namamali"] },
  { region: "Western", county: "Kakamega", subcounty: "Butere", wards: ["Marama West", "Marama Central", "Marenyo/Shianda", "Marama North", "Marama South"] },
  { region: "Western", county: "Kakamega", subcounty: "Khwisero", wards: ["Kisa North", "Kisa Central", "Kisa East", "Kisa West"] },
  { region: "Western", county: "Kakamega", subcounty: "Shinyalu", wards: ["Isukha North", "Isukha Central", "Isukha South", "Isukha East", "Isukha West", "Murhanda"] },
  { region: "Western", county: "Kakamega", subcounty: "Ikolomani", wards: ["Idakho North", "Idakho Central", "Idakho South", "Idakho East"] },
  { region: "Western", county: "Kakamega", subcounty: "Malava", wards: ["West Kabras", "Chemuche", "East Kabras", "Butali/Chegulo", "Manda/Shivanga", "South Kabras"] },
  { region: "Western", county: "Kakamega", subcounty: "Lugari", wards: ["Mautuma", "Lugari", "Lumakanda", "Chekalini", "Chevaywa", "Lwandeti"] },
  { region: "Western", county: "Kakamega", subcounty: "Likuyani", wards: ["Likuyani", "Sango", "Kongoni", "Nzoia", "Sinoko"] },
  { region: "Western", county: "Kakamega", subcounty: "Navakholo", wards: ["Ingotse/Matiha", "Bunyala West", "Bunyala East", "Bunyala Central", "Chemakhala"] },

  // ---- Vihiga ----
  { region: "Western", county: "Vihiga", subcounty: "Vihiga", wards: ["Lugaga/Wamuluma", "South Maragoli", "Central Maragoli", "Mungoma"] },
  { region: "Western", county: "Vihiga", subcounty: "Sabatia", wards: ["Lyaduywa/Izava", "West Sabatia", "Chavakali", "North Maragoli", "Wodanga", "Busali"] },
  { region: "Western", county: "Vihiga", subcounty: "Hamisi", wards: ["Shiru", "Gisambai", "Shamakhokho", "Banja", "Muhudu", "Tambua", "Jepkoyai"] },
  { region: "Western", county: "Vihiga", subcounty: "Luanda", wards: ["Luanda Township", "Wemilabi", "Mwibona", "Luanda South", "Emabungo"] },
  { region: "Western", county: "Vihiga", subcounty: "Emuhaya", wards: ["North East Bunyore", "Central Bunyore", "West Bunyore"] },

  // ---- Bungoma ----
  { region: "Western", county: "Bungoma", subcounty: "Kanduyi", wards: ["Bukembe West", "Bukembe East", "Township", "Khalaba", "Musikoma", "East Sang'alo", "Marakaru/Tuuti", "West Sang'alo"] },
  { region: "Western", county: "Bungoma", subcounty: "Bumula", wards: ["South Bukusu", "Bumula", "Khasoko", "Kabula", "Kimaeti", "West Bukusu", "Siboti"] },
  { region: "Western", county: "Bungoma", subcounty: "Webuye East", wards: ["Mihuu", "Ndivisi", "Maraka"] },
  { region: "Western", county: "Bungoma", subcounty: "Webuye West", wards: ["Sitikho", "Matulo", "Bokoli"] },
  { region: "Western", county: "Bungoma", subcounty: "Kimilili", wards: ["Kibingei", "Kimilili", "Maeni", "Kamukuywa"] },
  { region: "Western", county: "Bungoma", subcounty: "Tongaren", wards: ["Mbakalo", "Naitiri/Kabuyefwe", "Milima", "Ndalu/Tabani", "Tongaren", "Soysambu/Mitua"] },
  { region: "Western", county: "Bungoma", subcounty: "Sirisia", wards: ["Namwela", "Malakisi/South Kulisiru", "Lwandanyi"] },
  { region: "Western", county: "Bungoma", subcounty: "Kabuchai", wards: ["Kabuchai/Chwele", "West Nalondo", "Bwake/Luuya", "Mukuyuni"] },
  { region: "Western", county: "Bungoma", subcounty: "Mt Elgon", wards: ["Cheptais", "Chesikaki", "Chepyuk", "Kapkateny", "Kaptama", "Elgon"] },

  // ---- Busia ----
  { region: "Western", county: "Busia", subcounty: "Matayos", wards: ["Bukhayo West", "Mayenje", "Matayos South", "Busibwabo", "Burumba"] },
  { region: "Western", county: "Busia", subcounty: "Nambale", wards: ["Nambale Township", "Bukhayo North/Waltsi", "Bukhayo East", "Bukhayo Central"] },
  { region: "Western", county: "Busia", subcounty: "Butula", wards: ["Marachi West", "Kingandole", "Marachi Central", "Marachi East", "Marachi North", "Elugulu"] },
  { region: "Western", county: "Busia", subcounty: "Funyula", wards: ["Namboboto/Nambuku", "Nangina", "Ageng'a/Nanguba", "Bwiri"] },
  { region: "Western", county: "Busia", subcounty: "Budalangi", wards: ["Bunyala Central", "Bunyala North", "Bunyala West", "Bunyala South"] },
  { region: "Western", county: "Busia", subcounty: "Teso North", wards: ["Malaba Central", "Malaba North", "Ang'urai South", "Ang'urai North", "Ang'urai East", "Malaba South"] },
  { region: "Western", county: "Busia", subcounty: "Teso South", wards: ["Ang'orom", "Chakol South", "Chakol North", "Amukura West", "Amukura East", "Amukura Central"] },

  // ---- Trans-Nzoia (Luhya/Kalenjin mix) ----
  { region: "Western", county: "Trans-Nzoia", subcounty: "Kiminini", wards: ["Kiminini", "Waitaluk", "Sirende", "Hospital", "Sikhendu", "Nabiswa"] },
  { region: "Western", county: "Trans-Nzoia", subcounty: "Saboti", wards: ["Kinyoro", "Matisi", "Tuwani", "Saboti", "Machewa"] },
  { region: "Western", county: "Trans-Nzoia", subcounty: "Kwanza", wards: ["Kapomboi", "Kwanza", "Keiyo", "Bidii"] },
  { region: "Western", county: "Trans-Nzoia", subcounty: "Endebess", wards: ["Endebess", "Chepchoina", "Matumbei"] },
  { region: "Western", county: "Trans-Nzoia", subcounty: "Cherangany", wards: ["Sinyerere", "Makutano", "Kaplamai", "Motosiet", "Cherangany/Suwerwa", "Chepsiro/Kiptoror", "Sitatunga"] },
];

const NYANZA: Row[] = [
  { region: "Nyanza", county: "Kisumu", subcounty: "Kisumu Central", wards: ["Railways", "Migosi", "Shaurimoyo Kaloleni", "Market Milimani", "Kondele", "Nyalenda B"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Kisumu East", wards: ["Kajulu", "Kolwa East", "Manyatta B", "Nyalenda A", "Kolwa Central"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Kisumu West", wards: ["South West Kisumu", "Central Kisumu", "Kisumu North", "West Kisumu", "North West Kisumu"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Seme", wards: ["West Seme", "Central Seme", "East Seme", "North Seme"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Nyando", wards: ["East Kano/Wawidhi", "Awasi/Onjiko", "Ahero", "Kabonyo/Kanyagwal", "Kobura"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Muhoroni", wards: ["Miwani", "Ombeyi", "Masogo/Nyang'oma", "Chemelil", "Muhoroni/Koru"] },
  { region: "Nyanza", county: "Kisumu", subcounty: "Nyakach", wards: ["South West Nyakach", "North Nyakach", "Central Nyakach", "West Nyakach", "South East Nyakach"] },

  { region: "Nyanza", county: "Siaya", subcounty: "Alego Usonga", wards: ["Usonga", "West Alego", "Central Alego", "Siaya Township", "North Alego", "South East Alego"] },
  { region: "Nyanza", county: "Siaya", subcounty: "Gem", wards: ["North Gem", "West Gem", "Central Gem", "Yala Township", "East Gem", "South Gem"] },
  { region: "Nyanza", county: "Siaya", subcounty: "Bondo", wards: ["West Yimbo", "Central Sakwa", "South Sakwa", "Yimbo East", "West Sakwa", "North Sakwa"] },
  { region: "Nyanza", county: "Siaya", subcounty: "Rarieda", wards: ["East Asembo", "West Asembo", "North Uyoma", "South Uyoma", "West Uyoma"] },
  { region: "Nyanza", county: "Siaya", subcounty: "Ugenya", wards: ["West Ugenya", "Ukwala", "North Ugenya", "East Ugenya"] },
  { region: "Nyanza", county: "Siaya", subcounty: "Ugunja", wards: ["Sidindi", "Sigomere", "Ugunja"] },

  { region: "Nyanza", county: "Homa Bay", subcounty: "Homa Bay Town", wards: ["Homa Bay Central", "Homa Bay Arujo", "Homa Bay West", "Homa Bay East"] },
  { region: "Nyanza", county: "Homa Bay", subcounty: "Rangwe", wards: ["West Gem", "East Gem", "Kagan", "Kochia"] },
  { region: "Nyanza", county: "Homa Bay", subcounty: "Ndhiwa", wards: ["Kwabwai", "Kanyadoto", "Kanyikela", "Kabuoch North", "Kabuoch South/Pala", "Kanyamwa Kologi", "Kanyamwa Kosewe"] },
  { region: "Nyanza", county: "Homa Bay", subcounty: "Mbita", wards: ["Mfangano Island", "Rusinga Island", "Kasgunga", "Gembe", "Lambwe"] },
  { region: "Nyanza", county: "Homa Bay", subcounty: "Karachuonyo", wards: ["West Karachuonyo", "North Karachuonyo", "Central", "Kanyaluo", "Kibiri", "Wangchieng", "Kendu Bay Town"] },

  { region: "Nyanza", county: "Migori", subcounty: "Suna East", wards: ["God Jope", "Suna Central", "Kakrao", "Kwa"] },
  { region: "Nyanza", county: "Migori", subcounty: "Suna West", wards: ["Wiga", "Wasweta II", "Ragana-Oruba", "Wasimbete"] },
  { region: "Nyanza", county: "Migori", subcounty: "Rongo", wards: ["North Kamagambo", "Central Kamagambo", "East Kamagambo", "South Kamagambo"] },
  { region: "Nyanza", county: "Migori", subcounty: "Nyatike", wards: ["Kachien'g", "Kanyasa", "North Kadem", "Macalder/Kanyarwanda", "Kaler", "Got Kachola", "Muhuru"] },
  { region: "Nyanza", county: "Migori", subcounty: "Kuria West", wards: ["Bukira East", "Bukira Central/Ikerege", "Isibania", "Makerero", "Masaba", "Tagare", "Nyamosense/Komosoko"] },

  { region: "Nyanza", county: "Kisii", subcounty: "Kitutu Chache North", wards: ["Monyerero", "Sensi", "Marani", "Kegogi"] },
  { region: "Nyanza", county: "Kisii", subcounty: "Kitutu Chache South", wards: ["Bogusero", "Bogeka", "Nyakoe", "Kitutu Central", "Nyatieko"] },
  { region: "Nyanza", county: "Kisii", subcounty: "Nyaribari Masaba", wards: ["Ichuni", "Nyamasibi", "Masimba", "Gesusu", "Kiamokama"] },
  { region: "Nyanza", county: "Kisii", subcounty: "Bonchari", wards: ["Bomariba", "Bogiakumu", "Bomorenda", "Riana"] },
  { region: "Nyanza", county: "Kisii", subcounty: "South Mugirango", wards: ["Tabaka", "Boikang'a", "Bogetenga", "Borabu/Chitago", "Moticho", "Getenga"] },

  { region: "Nyanza", county: "Nyamira", subcounty: "Nyamira North", wards: ["Itibo", "Bomwagamo", "Bokeira", "Magwagwa", "Ekerenyo"] },
  { region: "Nyanza", county: "Nyamira", subcounty: "Borabu", wards: ["Mekenene", "Kiabonyoru", "Nyansiongo", "Esise"] },
  { region: "Nyanza", county: "Nyamira", subcounty: "Manga", wards: ["Manga", "Gesima", "Gachuba", "Kemera"] },
];

export const KENYA_LOCATION_ROWS = [...WESTERN, ...NYANZA];
