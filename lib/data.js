// =====================================================================
// Desert Trade: The Game — game data
// Everything students see about cities, goods, distances, encounters and
// the default level setup lives here. Prices and levels can also be edited
// from the Teacher page (those edits are saved in the database and win
// over the defaults below).
// =====================================================================

export const CITY_ORDER = [
  'cairo', 'jerusalem', 'constantinople', 'mecca',
  'bilma', 'sijilmasa', 'taghaza', 'timbuktu',
];

export const CITIES = {
  cairo: {
    name: 'Cairo',
    image: '/img/city-cairo.webp',
    blurb: 'Cairo sits on the Nile where Africa meets the Mediterranean and the Red Sea. Its giant markets pull in gold and ivory from across the Sahara and silk, spices and porcelain from Asia. When Mansa Musa of Mali passed through in 1324 on his way to Mecca, he spent so much gold here that its value dropped for years.',
  },
  jerusalem: {
    name: 'Jerusalem',
    image: '/img/city-jerusalem.webp',
    blurb: 'A holy city for Jews, Christians and Muslims, Jerusalem is always crowded with pilgrims. The hills around it are covered in olive groves and vineyards, so its merchants sell oil, grapes and wine, and buy fine goods for visiting travelers.',
  },
  constantinople: {
    name: 'Constantinople',
    image: '/img/city-constantinople.webp',
    blurb: 'Capital of the Byzantine Empire, Constantinople guards the narrow strait between Europe and Asia. Silk Road caravans and Mediterranean ships meet here, which makes it the place to buy silk, spices, jewelry and paper.',
  },
  mecca: {
    name: 'Mecca',
    image: '/img/city-mecca.webp',
    blurb: 'Mecca is the holiest city of Islam. Every year thousands of pilgrims arrive for the Hajj, and many pay for their journey by trading along the way. Desert herders sell camels, sheep, leather and dates in its markets.',
  },
  bilma: {
    name: 'Bilma',
    image: '/img/city-bilma.webp',
    blurb: 'Bilma is a small oasis deep in the central Sahara. Its people dig salt from shallow pits and trade it to passing caravans, but almost everything else, from grain to cloth, has to be carried in across the sand.',
  },
  sijilmasa: {
    name: 'Sijilmasa',
    image: '/img/city-sijilmasa.webp',
    blurb: 'Founded in the 700s at the northern edge of the Sahara, Sijilmasa was the gateway for caravans heading south. West African gold flowed in, and its workshops struck that gold into coins used across North Africa.',
  },
  taghaza: {
    name: 'Taghaza',
    image: '/img/city-taghaza.webp',
    blurb: 'Taghaza is a salt mining town in the middle of the desert. The traveler Ibn Battuta wrote that even its houses and mosque were built from blocks of salt. Nothing grows here, so food and water are very expensive.',
  },
  timbuktu: {
    name: 'Timbuktu',
    image: '/img/city-timbuktu.webp',
    blurb: 'Timbuktu, in the Mali Empire near the Niger River, was a center of trade and learning. Scholars filled its libraries with handwritten books, so paper was always in demand, and gold from the south was cheaper here than almost anywhere.',
  },
};

// Travel chart: [miles, days]. Same values as the Merchant's Guide chart.
const D = {
  cairo:          { jerusalem: [330, 13], constantinople: [961, 38], mecca: [999, 40], bilma: [1739, 70], sijilmasa: [2629, 105], taghaza: [2812, 112], timbuktu: [2932, 117] },
  jerusalem:      { constantinople: [907, 36], mecca: [961, 38], bilma: [2069, 83], sijilmasa: [2891, 116], taghaza: [3110, 124], timbuktu: [3254, 130] },
  constantinople: { mecca: [1868, 75], bilma: [2264, 91], sijilmasa: [2449, 98], taghaza: [2830, 113], timbuktu: [3167, 127] },
  mecca:          { bilma: [2193, 88], sijilmasa: [3493, 140], taghaza: [3557, 142], timbuktu: [3509, 140] },
  bilma:          { sijilmasa: [1726, 69], taghaza: [1515, 61], timbuktu: [1320, 53] },
  sijilmasa:      { taghaza: [602, 24], timbuktu: [1257, 50] },
  taghaza:        { timbuktu: [671, 27] },
};

export function route(a, b) {
  if (a === b) return null;
  const r = (D[a] && D[a][b]) || (D[b] && D[b][a]);
  return r ? { miles: r[0], days: r[1] } : null;
}

export function distanceTable() {
  const t = {};
  for (const a of CITY_ORDER) {
    t[a] = {};
    for (const b of CITY_ORDER) if (a !== b) t[a][b] = route(a, b);
  }
  return t;
}

// Goods. unit = what one "quantity" is. shop = name of the store selling/buying it.
export const ITEMS = {
  food:            { name: 'Food',               unit: 'lb',    shop: 'Provisioner',            desc: 'Dried bread, cheese and dried meat for the road. 1 lb feeds you for 25 days of travel.' },
  water:           { name: 'Water',              unit: 'jug',   shop: 'Well Keeper',            desc: 'A sealed clay jug of fresh water. 1 jug lasts 25 days of travel.' },
  gold:            { name: 'Gold',               unit: 'lb',    shop: 'Gold Dealer',            desc: 'Gold dust and nuggets from the mines south of the Sahara.' },
  ivory:           { name: 'Ivory',              unit: 'lb',    shop: 'Ivory Carver',           desc: 'Elephant tusk prized for carvings, combs and boxes.' },
  spices:          { name: 'Spices',             unit: 'lb',    shop: 'Spice Seller',           desc: 'Pepper, cloves and nutmeg carried from India and Southeast Asia.' },
  silk:            { name: 'Silk',               unit: 'lb',    shop: 'Silk Weaver',            desc: 'Smooth, shining cloth first made in China and later in Byzantine workshops.' },
  porcelain:       { name: 'Porcelain',          unit: 'lb',    shop: 'Porcelain Merchant',     desc: 'Thin, glassy pottery from China. Beautiful and easy to break.' },
  salt:            { name: 'Salt',               unit: 'lb',    shop: 'Salt Trader',            desc: 'Needed to preserve food and stay healthy in the heat. Worth its weight in gold in some places.' },
  textiles:        { name: 'Clothing Textiles',  unit: 'lb',    shop: 'Cloth Merchant',         desc: 'Linen and cotton cloth woven in Egyptian workshops.' },
  glassware:       { name: 'Glassware',          unit: 'lb',    shop: 'Glassblower',            desc: 'Colored glass lamps, bottles and cups.' },
  sugar:           { name: 'Sugar',              unit: 'lb',    shop: 'Sugar Refiner',          desc: 'Cane sugar boiled into hard loaves. A luxury sweetener.' },
  swords:          { name: 'Swords & Armor',     unit: 'lb',    shop: 'Armorer',                desc: 'Steel blades, helmets and mail for guards and soldiers.' },
  grain:           { name: 'Grain (wheat & millet)', unit: 'lb', shop: 'Grain Merchant',        desc: 'Sacks of wheat and millet. Desert towns cannot grow their own.' },
  livestock:       { name: 'Livestock',          unit: 'cow',   shop: 'Cattle Buyer',           desc: 'Cattle for meat, milk and hides.' },
  cinnamon:        { name: 'Cinnamon',           unit: 'lb',    shop: 'Cinnamon Buyer',         desc: 'Sweet bark from Sri Lanka used in food and medicine.' },
  precious_stones: { name: 'Precious Stones',    unit: 'lb',    shop: 'Gem Cutter',             desc: 'Rubies, emeralds and pearls.' },
  olive_oil:       { name: 'Olive Oil',          unit: 'lb',    shop: 'Olive Press',            desc: 'Pressed oil for cooking, lamps and soap.' },
  grapes:          { name: 'Grapes',             unit: 'lb',    shop: 'Vineyard Stall',         desc: 'Fresh and dried grapes from hillside vineyards.' },
  wine:            { name: 'Wine',               unit: 'lb',    shop: 'Vintner',                desc: 'Wine sealed in clay jars.' },
  furs:            { name: 'Furs',               unit: 'lb',    shop: 'Furrier',                desc: 'Warm pelts from the forests of northern Europe and Russia.' },
  paper:           { name: 'Paper for Books',    unit: 'lb',    shop: 'Paper Maker',            desc: 'Sheets of paper for copying books and keeping records.' },
  jewelry:         { name: 'Jewelry',            unit: 'lb',    shop: 'Jeweler',                desc: 'Rings, necklaces and bracelets of gold, silver and gems.' },
  perfume:         { name: 'Perfumes & Incense', unit: 'lb',    shop: 'Perfumer',               desc: 'Frankincense, myrrh and scented oils from Arabia.' },
  dates:           { name: 'Dates',              unit: 'lb',    shop: 'Date Seller',            desc: 'Sweet fruit from desert palm trees that keeps for months.' },
  leather:         { name: 'Leather Goods',      unit: 'lb',    shop: 'Leatherworker',          desc: 'Saddles, bags, sandals and water skins.' },
  camels:          { name: 'Camels',             unit: 'camel', shop: 'Camel Market',           desc: 'The ship of the desert. Can walk for days without water.' },
  sheep:           { name: 'Sheep',              unit: 'sheep', shop: 'Shepherd',               desc: 'Raised for wool, milk and meat.' },
  ostrich:         { name: 'Ostrich Feathers',   unit: 'lb',    shop: 'Feather Buyer',          desc: 'Large plumes used for fans and decoration.' },
  kola:            { name: 'Kola Nuts',          unit: 'lb',    shop: 'Kola Nut Buyer',         desc: 'Bitter nuts from West African forests, chewed for energy.' },
  coins:           { name: 'Coins',              unit: 'lb',    shop: 'Mint',                   desc: 'Gold dinars struck in Sijilmasa\u2019s mint.' },
  copper:          { name: 'Copper',             unit: 'lb',    shop: 'Copper Buyer',           desc: 'Metal for pots, tools and jewelry.' },
};

// Market prices. exports = the city SELLS these (players buy).
// imports = the city BUYS these (players sell).
// Jerusalem and Mecca had no prices in the planning doc, so the numbers
// marked PLACEHOLDER are starter values — change them on the Teacher page.
export const DEFAULT_MARKETS = {
  cairo: {
    food: 5, water: 5,
    imports: [['gold', 100], ['ivory', 50], ['spices', 110], ['silk', 80], ['porcelain', 40], ['salt', 110]],
    exports: [['textiles', 10], ['glassware', 15], ['sugar', 20], ['swords', 15]],
  },
  bilma: {
    food: 15, water: 3,
    imports: [['grain', 50], ['livestock', 50], ['textiles', 100]],
    exports: [['salt', 50]],
  },
  jerusalem: { // PLACEHOLDER prices
    food: 5, water: 8,
    imports: [['silk', 90], ['cinnamon', 70], ['precious_stones', 45], ['glassware', 40], ['swords', 45]],
    exports: [['sugar', 15], ['olive_oil', 20], ['grain', 10], ['grapes', 15], ['wine', 25]],
  },
  constantinople: {
    food: 3, water: 3,
    imports: [['furs', 15], ['precious_stones', 20], ['olive_oil', 60], ['grapes', 50]],
    exports: [['silk', 50], ['paper', 20], ['jewelry', 50], ['spices', 80]],
  },
  mecca: { // PLACEHOLDER prices
    food: 10, water: 10,
    imports: [['spices', 130], ['perfume', 90], ['grain', 40]],
    exports: [['dates', 15], ['leather', 25], ['camels', 150], ['sheep', 40]],
  },
  taghaza: {
    food: 30, water: 40,
    imports: [['dates', 50], ['grain', 50], ['food', 50]],
    exports: [['salt', 25]],
  },
  sijilmasa: {
    food: 5, water: 3,
    imports: [['wine', 80], ['gold', 80], ['ivory', 50], ['ostrich', 10], ['kola', 15]],
    exports: [['salt', 30], ['dates', 20], ['coins', 30]],
  },
  timbuktu: {
    food: 15, water: 5,
    imports: [['salt', 20], ['copper', 50], ['paper', 100]],
    exports: [['gold', 20], ['ivory', 40]],
  },
};

// Road encounters. chance = % chance of happening on a trip.
// wins = how many of the six die faces are a success (the faces are picked
// at random for every trip and never shown to students).
export const ENCOUNTERS = {
  bandits:   { name: 'Bandits',       chance: 10, wins: 3, roll: true,  image: '/img/enc-bandits.webp' },
  sandstorm: { name: 'Sandstorm',     chance: 10, wins: 4, roll: true,  image: '/img/enc-sandstorm.webp' },
  heat:      { name: 'Extreme Heat',  chance: 15, wins: 4, roll: true,  image: '/img/enc-heat.webp' },
  cold:      { name: 'Extreme Cold',  chance: 15, wins: 4, roll: true,  image: '/img/enc-cold.webp' },
  oasis:     { name: 'Oasis',         chance: 10, wins: 6, roll: true,  image: '/img/enc-oasis.webp' },
  basecamp:  { name: 'Base Camp',     chance: 40, wins: 6, roll: false, image: '/img/enc-basecamp.webp' },
};

export const DEFAULT_LEVELS = [
  { name: 'Student Trader',    days: 170,  start_city: 'cairo', password: 'camel1', start_bonus: 200, early_bonus: 2,
    instructions: 'Go to Bilma and come back. Make as much money as possible.' },
  { name: 'Apprentice Trader', days: 180,  start_city: 'cairo', password: 'camel2', start_bonus: 0, early_bonus: 2,
    instructions: 'Find the shortest route to get spices back to Cairo.' },
  { name: 'Beginning Trader',  days: 350,  start_city: 'cairo', password: 'camel3', start_bonus: 0, early_bonus: 2,
    instructions: 'Sijilmasa wants wine. Get it to them and make a lot of money doing it.' },
  { name: 'Advanced Trader',   days: 500,  start_city: 'cairo', password: 'camel4', start_bonus: 0, early_bonus: 2,
    instructions: 'Timbuktu wants paper. Get as much gold as you can and sell it back in Cairo.' },
  { name: 'Master Trader',     days: 1000, start_city: 'cairo', password: 'camel5', start_bonus: 0, early_bonus: 2,
    instructions: 'Go anywhere and make as much money as possible.' },
];

export const DEFAULT_SETTINGS = {
  starting_money: 100,   // given once when a trader is created
  seconds_per_day: 1,    // travel counter speed (spec: 1 day per second)
  loss_scope: 'supplies', // 'supplies' = bandits/sandstorm take food & water; 'all' = all cargo
};

export const DAYS_PER_RATION = 25; // 1 food + 1 water per 25 days of travel
export const MAX_CARAVAN = 5;
