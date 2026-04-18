require 'json'

# Map of category IDs to human-readable names
CATEGORY_MAP = {
  -2 => "Gem",
  -4 => "Fish", # 0, 2, 4 (not sure what 3 is)
  -5 => "Animal Products", # Egg category
  -6 => "Animal Products", # Milk category
  -7 => "Cooking", # quality 0 and 2
  -8 => "Crafting", # need to map this manually
  -9 => "Machines",
  -12 => "Minerals",
  -15 => "Resources",
  -16 => "Resources",
  -17 => "Animal Products",
  -18 => "Animal Products",
  -19 => "Fertilizers",
  -23 => "Fish",
  -20 => "Trash",
  -21 => "Bait",
  -22 => "Bobbers",
  -24 => "Furniture",
  -26 => "Artisan",
  -27 => "Resources",
  -28 => "Monster Drops",
  -74 => "Seeds",
  -75 => "Vegetables",
  -79 => "Fruits",
  -80 => "Flowers",
  -81 => "Forage",
  -95 => "Ignore",
  -96 => "Ignore",
  -97 => "Ignore",
  -98 => "Ignore",
  -99 => "Tools",
  -102 => "Books",
  -103 => "Books",
  -999 => "Ignore",
  1111 => "Resources",
  1112 => "Consumables",
  1113 => "Monster Drops",
  1114 => "Machines",
  1115 => "Geodes",
  1116 => "Decoration (Lighting)",
  1117 => "Gifts/Rewards",
  1118 => "Artifacts",
  1119 => "Artisan Goods (Other)",
  1120 => "Artisan Goods (Keg)",
  1121 => "Artisan Goods (Dehydrator)",
  1122 => "Artisan Goods (Jar)",
  1123 => "Decoration (Other)",
  1124 => "Smoked Fish",
}

BC_NAMES = {
  110 => "Rarecrow 1",
  113 => "Rarecrow 2",
  126 => "Rarecrow 3",
  136 => "Rarecrow 4",
  137 => "Rarecrow 5",
  138 => "Rarecrow 6",
  139 => "Rarecrow 7",
  140 => "Rarecrow 8"
}
BC_IGNORE = [
  # house plants. Only 2 from movie theatre is valid now.
  "0", "1","3","4","5","6","7",
  # mushroom box (cave, demetreus)
  "128",
  #Ancient Table and Stool, Grandfather Clock, teddy timer
  "22", "23", "26", "27", "28", "29", "56",
  "64", "65","66", "67", "68", "69", "70", "72", "73", "74", "75", "76", "78", "79", "80", "81", "82",
  "85", "86", "87", "88", "89", "94", "96", "98",
  "106", "111", "112", "116", "117", "118", "119", "120", "121", "122", "123", "124", "125",
  "141", "159", "160", "164", "174", "175", "219", "221", "246", "247", "262", "263", "280"
].map{|a| ["(BC)#{a}", a]}.flatten
# where the item can be any of a specific category to craft.
ANIES = {
  # the -4 corresponds with the category Fish.
  "-4" => {"name" => "Fish: Extra", "id": -4 },
  "-5" => {"name" => "Egg; Extra", "id": -5 },
  "-6" => {"name" => "Milk: Extra", "id": -6},
  "-777" =>{"name" => "Wild Seeds", "id": -777},
}
# NS = Non Stackable Catagories
NS_CATS = [
  # bobbers, from StardewValley/Object.cs
  -22,
  -999
]
NS_IDS = [
  "102",
  "73",
  "858",
  "803",
  "447",
  # from StardewValley/Object.cs
  "79",
  "842",
  "911",
  "930",
  "PetLicense",
  "Gold Coin",
  "CalicoEgg",
  "SpecificBait",
  "DriedFruit",
  "DriedMushrooms",
  # legendary fish
  "159", "160", "163", "682", "775",
  # roe (just roe)
  "812",
  "326", "461"

]

SHOP_NAMES = {
  "Traveler" => "Travelling Cart",
  "DesertTrade" => "Desert Trader",
  "Carpenter" => "Carpenter's Shop",
  "DesertFestival" => "Desert Festival",
}

CAT_ITEMS = JSON.parse(File.read("CategoryItems.json"))

ITEM_CAT = CAT_ITEMS.flat_map { |cat, items| items.map { |item| [item, cat] } }.to_h

DRIED_CAT = "Artisan Goods (Dehydrator)"

DISPLAY_NAME = {
  "Dinosaur Egg" => "Egg: Dinosaur",
  "Book_Artifact" => "Treasures Appraisal Guide",
  "Book_Grass" => "Ol' Slitherlegs",
  "Book_Horse" => "Horse: The Book",
  "Wilted Bouquet" => "Bouquet: Wilted",
  "Explosive Ammo" => "Bomb: Explosive Ammo",
  "Bomb" => "Bomb: Bomb",
  "Cherry Bomb" => "Bomb: Cherry",
  "Mega Bomb" => "Bomb: Mega",
  "Warp Totem: Beach"     => "Totem: Beach",
  "Warp Totem: Desert"    => "Totem: Desert",
  "Warp Totem: Farm"      => "Totem: Farm",
  "Warp Totem: Island"    => "Totem: Island",
  "Warp Totem: Mountains" => "Totem: Mountains",
  "Rain Totem"      => "Totem: Rain",
  "Treasure Totem"     => "Totem: Treasure",
  "Cave Jelly" => "Jelly: Cave",
  "River Jelly" => "Jelly: River",
  "Sea Jelly" => "Jelly: Sea",
  "Blue Slime Egg" => "Slime Egg: Blue",
  "Green Slime Egg" => "Slime Egg: Green",
  "Purple Slime Egg" => "Slime Egg: Purple",
  "Red Slime Egg" => "Slime Egg: Red",
  "Tiger Slime Egg" => "Slime Egg: Tiger",
  "Sunflower Honey" => "Honey: Sunflower",
  "Tulip Honey" => "Honey: Tulip",
  "Summer Spangle Honey" => "Honey: Summer Spangle",
  "Fairy Rose Honey" => "Honey: Fairy Rose",
  "Blue Jazz Honey" => "Honey: Blue Jazz",
  "Poppy Honey" => "Honey: Poppy",
  "Wild Honey" => "Honey: Wile",
  "Chanterelle" => "Mushroom: Chanterelle",
  "Common Mushroom" => "Mushroom: Common",
  "Magma Cap" => "Mushroom: Magma Cap",
  "Morel" => "Mushroom: Morel",
  "Purple Mushroom" => "Mushroom: Purple",
  "Red Mushroom" => "Mushroom: Red",
  "Quality Sprinkler" => "Sprinkler: Quality",
  "Sprinkler" => "Sprinkler: Basic",
  "Iridium Sprinkler" => "Sprinkler: Iridium",
  "Deluxe Scarecrow" => "Scarecrow: Deluxe",
  "Dinosaur Mayonnaise" => "Mayanaise: Dino",
  "Duck Mayonnaise" => "Mayanaise: Duck",
  "Void Mayonnaise" => "Mayanaise: Void",
}

REMOVE = [
  "Lumber",
  "Spirit Torch",
  "Warp Totem: Qi's Arena",
  "Stardrop",
  "SupplyCrate",
  "Hedge",
  "Camping Stove",
  "Slime Crate",
  "Angler Bait",
  "Crimsonfish Bait",
  "Glacierfish Bait",
  "Legend Bait",
  "Mutant Carp Bait",
  "SeaWeed Bait",
  "Artifact Spot",
  "Seed Spot",
  "Gold Coin",
  "Mermaid's Pendant",
  "Stone Base",
  "Roe",
  "Squid Ink Bait",
  "Sea Urchin Bait",
  "Smoked"
]

ALLOWED_QUESTS = [
  "Golden Coconut",
  "Trimmed Lucky Purple Shorts",
  "Lucky Purple Shorts",
  "Golden Bobber",
]

# we remove legends from fish, since you cannot catch these more than once
# so we need to add them for roe and aged roe. (also not bait)
LEGENDS = [
  "Angler",
  "Crimsonfish",
  "Glacierfish",
  "Legend",
  "Mutant Carp",
]

MANNNEQUINS = [
  "CursedMannequinFemale",
  "CursedMannequinMale",
  "MannequinFemale",
  "MannequinMale"
]

