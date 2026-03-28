// DayZ Base Game Item Database
// Used for OCR smart matching in the resource scanner

export const DAYZ_ITEMS = [
  // ─── WEAPONS ───────────────────────────────────────
  { name: 'AKM', category: 'Weapons', tags: ['akm', 'ak'] },
  { name: 'AK-74', category: 'Weapons', tags: ['ak74', 'ak-74'] },
  { name: 'AK-101', category: 'Weapons', tags: ['ak101', 'ak-101'] },
  { name: 'AKS-74U', category: 'Weapons', tags: ['aks74u', 'aks-74u', 'aksu'] },
  { name: 'SKS', category: 'Weapons', tags: ['sks'] },
  { name: 'SVD', category: 'Weapons', tags: ['svd', 'dragunov'] },
  { name: 'VSS Vintorez', category: 'Weapons', tags: ['vss', 'vintorez'] },
  { name: 'Mosin 9130', category: 'Weapons', tags: ['mosin', '9130'] },
  { name: 'BK-133', category: 'Weapons', tags: ['bk133', 'bk-133'] },
  { name: 'BK-43', category: 'Weapons', tags: ['bk43', 'bk-43'] },
  { name: 'CR-527', category: 'Weapons', tags: ['cr527', 'cr-527'] },
  { name: 'CR-550 Savanna', category: 'Weapons', tags: ['cr550', 'savanna'] },
  { name: 'CZ 527', category: 'Weapons', tags: ['cz527', 'cz 527'] },
  { name: 'CZ 61 Scorpion', category: 'Weapons', tags: ['cz61', 'scorpion'] },
  { name: 'CZ 75', category: 'Weapons', tags: ['cz75', 'cz-75'] },
  { name: 'Derringer', category: 'Weapons', tags: ['derringer'] },
  { name: 'FN FAL', category: 'Weapons', tags: ['fal', 'fn fal'] },
  { name: 'Glock 19', category: 'Weapons', tags: ['glock', 'glock19', 'glock 19'] },
  { name: 'IZH-18', category: 'Weapons', tags: ['izh18', 'izh-18'] },
  { name: 'IZH-43', category: 'Weapons', tags: ['izh43', 'izh-43'] },
  { name: 'KA-M', category: 'Weapons', tags: ['kam', 'ka-m'] },
  { name: 'KA-74', category: 'Weapons', tags: ['ka74', 'ka-74'] },
  { name: 'KAS-74U', category: 'Weapons', tags: ['kas74u', 'kas-74u'] },
  { name: 'KA-101', category: 'Weapons', tags: ['ka101', 'ka-101'] },
  { name: 'Longhorn', category: 'Weapons', tags: ['longhorn'] },
  { name: 'M14', category: 'Weapons', tags: ['m14'] },
  { name: 'M16-A2', category: 'Weapons', tags: ['m16', 'm16a2', 'm16-a2'] },
  { name: 'M249', category: 'Weapons', tags: ['m249'] },
  { name: 'M4-A1', category: 'Weapons', tags: ['m4', 'm4a1', 'm4-a1'] },
  { name: 'Magnum', category: 'Weapons', tags: ['magnum', '.357 magnum'] },
  { name: 'MP5-K', category: 'Weapons', tags: ['mp5', 'mp5k', 'mp5-k'] },
  { name: 'P1', category: 'Weapons', tags: ['p1'] },
  { name: 'P64', category: 'Weapons', tags: ['p64'] },
  { name: 'Pioneer', category: 'Weapons', tags: ['pioneer'] },
  { name: 'PM73 RAK', category: 'Weapons', tags: ['pm73', 'rak'] },
  { name: 'PP-19 Bizon', category: 'Weapons', tags: ['bizon', 'pp19', 'pp-19'] },
  { name: 'Repeater Carbine', category: 'Weapons', tags: ['repeater', 'carbine'] },
  { name: 'Revolver', category: 'Weapons', tags: ['revolver'] },
  { name: 'Sawed-off Mosin', category: 'Weapons', tags: ['sawed off mosin', 'sawedoff'] },
  { name: 'Scout', category: 'Weapons', tags: ['scout'] },
  { name: 'SP-5', category: 'Weapons', tags: ['sp5', 'sp-5'] },
  { name: 'Tundra', category: 'Weapons', tags: ['tundra'] },
  { name: 'UMP45', category: 'Weapons', tags: ['ump', 'ump45'] },
  { name: 'USG-45', category: 'Weapons', tags: ['usg45', 'usg-45'] },
  { name: 'Winchester Model 70', category: 'Weapons', tags: ['winchester', 'model 70'] },

  // ─── AMMO ──────────────────────────────────────────
  { name: '7.62x39 Rounds', category: 'Ammo', tags: ['7.62x39', '762x39'] },
  { name: '5.45x39 Rounds', category: 'Ammo', tags: ['5.45x39', '545x39'] },
  { name: '5.56x45 Rounds', category: 'Ammo', tags: ['5.56x45', '556x45', '5.56'] },
  { name: '7.62x54 Rounds', category: 'Ammo', tags: ['7.62x54', '762x54'] },
  { name: '7.62x51 Rounds', category: 'Ammo', tags: ['7.62x51', '762x51', '.308'] },
  { name: '9x19 Rounds', category: 'Ammo', tags: ['9x19', '9mm', '9x19mm'] },
  { name: '9x39 Rounds', category: 'Ammo', tags: ['9x39'] },
  { name: '.357 Rounds', category: 'Ammo', tags: ['.357', '357'] },
  { name: '.380 Rounds', category: 'Ammo', tags: ['.380', '380'] },
  { name: '.45 ACP Rounds', category: 'Ammo', tags: ['.45', '45acp', '.45 acp'] },
  { name: '12ga Buckshot', category: 'Ammo', tags: ['buckshot', '12ga buckshot', '12 gauge buckshot'] },
  { name: '12ga Slug', category: 'Ammo', tags: ['slug', '12ga slug', '12 gauge slug'] },
  { name: '12ga Birdshot', category: 'Ammo', tags: ['birdshot'] },
  { name: '.22 LR Rounds', category: 'Ammo', tags: ['.22', '22lr', '.22 lr'] },
  { name: 'Flare Cartridge', category: 'Ammo', tags: ['flare', 'flare cartridge'] },

  // ─── MEDICAL ───────────────────────────────────────
  { name: 'Bandage', category: 'Medical', tags: ['bandage', 'bandages'] },
  { name: 'Rag', category: 'Medical', tags: ['rag', 'rags'] },
  { name: 'Morphine', category: 'Medical', tags: ['morphine'] },
  { name: 'Epinephrine', category: 'Medical', tags: ['epinephrine', 'epi'] },
  { name: 'Saline Bag', category: 'Medical', tags: ['saline', 'saline bag', 'iv bag'] },
  { name: 'Blood Bag', category: 'Medical', tags: ['blood bag', 'blood'] },
  { name: 'Tetracycline', category: 'Medical', tags: ['tetracycline'] },
  { name: 'Charcoal Tablets', category: 'Medical', tags: ['charcoal', 'charcoal tablets'] },
  { name: 'Vitamins', category: 'Medical', tags: ['vitamins'] },
  { name: 'Iodine Tincture', category: 'Medical', tags: ['iodine', 'iodine tincture'] },
  { name: 'Disinfectant Spray', category: 'Medical', tags: ['disinfectant', 'spray'] },
  { name: 'Surgical Kit', category: 'Medical', tags: ['surgical kit', 'surgical'] },
  { name: 'Bone Saw', category: 'Medical', tags: ['bone saw'] },
  { name: 'Defibrillator', category: 'Medical', tags: ['defibrillator', 'defib'] },
  { name: 'Tourniquet', category: 'Medical', tags: ['tourniquet'] },
  { name: 'Splint', category: 'Medical', tags: ['splint'] },
  { name: 'Medical Kit', category: 'Medical', tags: ['medical kit', 'medkit'] },

  // ─── FOOD & DRINK ───────────────────────────────────
  { name: 'Canned Beans', category: 'Food & Water', tags: ['beans', 'canned beans'] },
  { name: 'Canned Sardines', category: 'Food & Water', tags: ['sardines', 'canned sardines'] },
  { name: 'Canned Spaghetti', category: 'Food & Water', tags: ['spaghetti', 'canned spaghetti'] },
  { name: 'Canned Peaches', category: 'Food & Water', tags: ['peaches', 'canned peaches'] },
  { name: 'Canned Peas', category: 'Food & Water', tags: ['peas', 'canned peas'] },
  { name: 'Canned Tuna', category: 'Food & Water', tags: ['tuna', 'canned tuna'] },
  { name: 'Powdered Milk', category: 'Food & Water', tags: ['powdered milk', 'milk powder'] },
  { name: 'Rice', category: 'Food & Water', tags: ['rice'] },
  { name: 'Pasta', category: 'Food & Water', tags: ['pasta'] },
  { name: 'Flour', category: 'Food & Water', tags: ['flour'] },
  { name: 'Sugar', category: 'Food & Water', tags: ['sugar'] },
  { name: 'Salt', category: 'Food & Water', tags: ['salt'] },
  { name: 'Apple', category: 'Food & Water', tags: ['apple', 'apples'] },
  { name: 'Pear', category: 'Food & Water', tags: ['pear', 'pears'] },
  { name: 'Plum', category: 'Food & Water', tags: ['plum', 'plums'] },
  { name: 'Kiwi', category: 'Food & Water', tags: ['kiwi'] },
  { name: 'Tomato', category: 'Food & Water', tags: ['tomato', 'tomatoes'] },
  { name: 'Zucchini', category: 'Food & Water', tags: ['zucchini'] },
  { name: 'Pumpkin', category: 'Food & Water', tags: ['pumpkin'] },
  { name: 'Potato', category: 'Food & Water', tags: ['potato', 'potatoes'] },
  { name: 'Water Bottle', category: 'Food & Water', tags: ['water bottle', 'bottle'] },
  { name: 'Canteen', category: 'Food & Water', tags: ['canteen'] },
  { name: 'Cooking Pot', category: 'Food & Water', tags: ['cooking pot', 'pot'] },
  { name: 'Frying Pan', category: 'Food & Water', tags: ['frying pan', 'pan'] },

  // ─── CLOTHING ──────────────────────────────────────
  { name: 'Gorka Jacket', category: 'Clothing', tags: ['gorka jacket', 'gorka'] },
  { name: 'Gorka Pants', category: 'Clothing', tags: ['gorka pants'] },
  { name: 'TTsKO Jacket', category: 'Clothing', tags: ['ttsko jacket', 'ttsko'] },
  { name: 'TTsKO Pants', category: 'Clothing', tags: ['ttsko pants'] },
  { name: 'Hunter Jacket', category: 'Clothing', tags: ['hunter jacket', 'hunter'] },
  { name: 'Hunter Pants', category: 'Clothing', tags: ['hunter pants'] },
  { name: 'Field Jacket', category: 'Clothing', tags: ['field jacket'] },
  { name: 'Assault Vest', category: 'Clothing', tags: ['assault vest'] },
  { name: 'Plate Carrier', category: 'Clothing', tags: ['plate carrier', 'platecarrier'] },
  { name: 'Press Vest', category: 'Clothing', tags: ['press vest'] },
  { name: 'Ballistic Helmet', category: 'Clothing', tags: ['ballistic helmet', 'ballistic'] },
  { name: 'Mich Helmet', category: 'Clothing', tags: ['mich', 'mich helmet'] },
  { name: 'Tactical Helmet', category: 'Clothing', tags: ['tactical helmet'] },
  { name: 'Welding Mask', category: 'Clothing', tags: ['welding mask'] },
  { name: 'Motorcycle Helmet', category: 'Clothing', tags: ['motorcycle helmet', 'moto helmet'] },
  { name: 'Combat Boots', category: 'Clothing', tags: ['combat boots'] },
  { name: 'Hiking Boots', category: 'Clothing', tags: ['hiking boots'] },
  { name: 'Military Boots', category: 'Clothing', tags: ['military boots'] },
  { name: 'Alice Backpack', category: 'Clothing', tags: ['alice', 'alice backpack'] },
  { name: 'Mountain Backpack', category: 'Clothing', tags: ['mountain backpack'] },
  { name: 'Tactical Backpack', category: 'Clothing', tags: ['tactical backpack'] },
  { name: 'Field Backpack', category: 'Clothing', tags: ['field backpack'] },

  // ─── BASE BUILDING ─────────────────────────────────
  { name: 'Plank', category: 'Base Building', tags: ['plank', 'planks'] },
  { name: 'Nails', category: 'Base Building', tags: ['nails', 'nail'] },
  { name: 'Barbed Wire', category: 'Base Building', tags: ['barbed wire', 'barbedwire'] },
  { name: 'Sandbag', category: 'Base Building', tags: ['sandbag', 'sandbags'] },
  { name: 'Coil of Wire', category: 'Base Building', tags: ['coil of wire', 'wire coil'] },
  { name: 'Wooden Log', category: 'Base Building', tags: ['log', 'logs', 'wooden log'] },
  { name: 'Short Stick', category: 'Base Building', tags: ['short stick', 'stick'] },
  { name: 'Long Stick', category: 'Base Building', tags: ['long stick'] },
  { name: 'Rope', category: 'Base Building', tags: ['rope'] },
  { name: 'Metal Wire', category: 'Base Building', tags: ['metal wire', 'wire'] },
  { name: 'Fence Kit', category: 'Base Building', tags: ['fence kit'] },
  { name: 'Watchtower Kit', category: 'Base Building', tags: ['watchtower kit', 'watchtower'] },
  { name: 'Gate Kit', category: 'Base Building', tags: ['gate kit', 'gate'] },
  { name: 'Tent', category: 'Base Building', tags: ['tent'] },
  { name: 'Car Tent', category: 'Base Building', tags: ['car tent'] },
  { name: 'Large Tent', category: 'Base Building', tags: ['large tent'] },
  { name: 'Wooden Crate', category: 'Base Building', tags: ['wooden crate', 'crate'] },
  { name: 'Barrel', category: 'Base Building', tags: ['barrel'] },
  { name: 'Sea Chest', category: 'Base Building', tags: ['sea chest'] },

  // ─── TOOLS ─────────────────────────────────────────
  { name: 'Hatchet', category: 'Tools', tags: ['hatchet', 'axe'] },
  { name: 'Hacksaw', category: 'Tools', tags: ['hacksaw'] },
  { name: 'Handsaw', category: 'Tools', tags: ['handsaw', 'saw'] },
  { name: 'Hammer', category: 'Tools', tags: ['hammer'] },
  { name: 'Screwdriver', category: 'Tools', tags: ['screwdriver'] },
  { name: 'Pliers', category: 'Tools', tags: ['pliers'] },
  { name: 'Wrench', category: 'Tools', tags: ['wrench'] },
  { name: 'Shovel', category: 'Tools', tags: ['shovel'] },
  { name: 'Pickaxe', category: 'Tools', tags: ['pickaxe', 'pick axe'] },
  { name: 'Knife', category: 'Tools', tags: ['knife'] },
  { name: 'Hunting Knife', category: 'Tools', tags: ['hunting knife'] },
  { name: 'Combat Knife', category: 'Tools', tags: ['combat knife'] },
  { name: 'Blowtorch', category: 'Tools', tags: ['blowtorch', 'blow torch'] },
  { name: 'Duct Tape', category: 'Tools', tags: ['duct tape', 'ducttape'] },
  { name: 'Sewing Kit', category: 'Tools', tags: ['sewing kit'] },
  { name: 'Leather Sewing Kit', category: 'Tools', tags: ['leather sewing kit'] },
  { name: 'Compass', category: 'Tools', tags: ['compass'] },
  { name: 'Map', category: 'Tools', tags: ['map'] },
  { name: 'GPS', category: 'Tools', tags: ['gps'] },
  { name: 'Binoculars', category: 'Tools', tags: ['binoculars'] },
  { name: 'Rangefinder', category: 'Tools', tags: ['rangefinder'] },
  { name: 'NVG', category: 'Tools', tags: ['nvg', 'night vision', 'nvgs'] },
  { name: 'Flashlight', category: 'Tools', tags: ['flashlight'] },
  { name: 'Headtorch', category: 'Tools', tags: ['headtorch', 'head torch'] },

  // ─── VEHICLES & PARTS ──────────────────────────────
  { name: 'Car Battery', category: 'Vehicle Parts', tags: ['car battery', 'battery'] },
  { name: 'Spark Plug', category: 'Vehicle Parts', tags: ['spark plug', 'sparkplug'] },
  { name: 'Headlight', category: 'Vehicle Parts', tags: ['headlight', 'head light'] },
  { name: 'Radiator', category: 'Vehicle Parts', tags: ['radiator'] },
  { name: 'Engine Belt', category: 'Vehicle Parts', tags: ['engine belt', 'belt'] },
  { name: 'Wheel', category: 'Vehicle Parts', tags: ['wheel', 'wheels', 'tire'] },
  { name: 'Trunk Lid', category: 'Vehicle Parts', tags: ['trunk lid', 'trunk'] },
  { name: 'Hood', category: 'Vehicle Parts', tags: ['hood'] },
  { name: 'Door', category: 'Vehicle Parts', tags: ['door'] },
  { name: 'Fuel Canister', category: 'Vehicle Parts', tags: ['fuel canister', 'jerry can', 'jerrycan', 'fuel'] },
  { name: 'Glow Plug', category: 'Vehicle Parts', tags: ['glow plug'] },

  // ─── ATTACHMENTS ───────────────────────────────────
  { name: 'PU Scope', category: 'Attachments', tags: ['pu scope', 'pu'] },
  { name: 'PSO-1 Scope', category: 'Attachments', tags: ['pso', 'pso-1', 'pso1'] },
  { name: 'ACOG Scope', category: 'Attachments', tags: ['acog'] },
  { name: 'ATOG 6x48', category: 'Attachments', tags: ['atog', 'atog 6x48'] },
  { name: 'KashtanScope', category: 'Attachments', tags: ['kashtan'] },
  { name: 'Kobra Sight', category: 'Attachments', tags: ['kobra', 'kobra sight'] },
  { name: 'Holographic Sight', category: 'Attachments', tags: ['holographic', 'holo'] },
  { name: 'RDS Sight', category: 'Attachments', tags: ['rds', 'red dot'] },
  { name: 'Long Range Scope', category: 'Attachments', tags: ['long range scope', 'long range'] },
  { name: 'Hunting Scope', category: 'Attachments', tags: ['hunting scope'] },
  { name: 'Suppressor', category: 'Attachments', tags: ['suppressor', 'silencer'] },
  { name: 'Muzzle Brake', category: 'Attachments', tags: ['muzzle brake'] },
  { name: 'Flash Hider', category: 'Attachments', tags: ['flash hider'] },
  { name: 'Compensator', category: 'Attachments', tags: ['compensator'] },
  { name: 'Pistol Suppressor', category: 'Attachments', tags: ['pistol suppressor'] },
  { name: 'Vertical Grip', category: 'Attachments', tags: ['vertical grip', 'grip'] },
  { name: 'Folded Stock', category: 'Attachments', tags: ['folded stock'] },
  { name: 'Wooden Stock', category: 'Attachments', tags: ['wooden stock'] },
  { name: 'Plastic Stock', category: 'Attachments', tags: ['plastic stock'] },
  { name: 'Drum Magazine', category: 'Attachments', tags: ['drum', 'drum mag', 'drum magazine'] },
  { name: 'STANAG Magazine', category: 'Attachments', tags: ['stanag', 'stanag mag'] },
  { name: 'Banana Magazine', category: 'Attachments', tags: ['banana mag', 'banana magazine'] },
  { name: 'Flashlight Attachment', category: 'Attachments', tags: ['flashlight attachment', 'weapon light'] },
  { name: 'Laser Sight', category: 'Attachments', tags: ['laser', 'laser sight'] },
]

// All item names as a flat array for fast lookup
export const ITEM_NAMES = DAYZ_ITEMS.map(i => i.name)

// Get category for a matched item
export function getItemCategory(name) {
  const item = DAYZ_ITEMS.find(i => i.name.toLowerCase() === name.toLowerCase())
  return item?.category || 'Other'
}

// Smart fuzzy match — returns best matching item or null
export function matchItem(rawText) {
  if (!rawText || rawText.length < 2) return null
  const text = rawText.toLowerCase().trim()

  // Exact name match first
  const exact = DAYZ_ITEMS.find(i => i.name.toLowerCase() === text)
  if (exact) return { ...exact, confidence: 'high', matched: exact.name }

  // Tag match
  const tagMatch = DAYZ_ITEMS.find(i => i.tags.some(tag => text.includes(tag) || tag.includes(text)))
  if (tagMatch) return { ...tagMatch, confidence: 'medium', matched: tagMatch.name }

  // Partial name match
  const partial = DAYZ_ITEMS.find(i =>
    i.name.toLowerCase().includes(text) || text.includes(i.name.toLowerCase().split(' ')[0])
  )
  if (partial) return { ...partial, confidence: 'low', matched: partial.name }

  // Unknown — might be a mod item
  return { name: rawText, category: 'Unknown', confidence: 'unknown', matched: rawText, possibleMod: true }
}