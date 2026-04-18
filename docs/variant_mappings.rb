# Variant mappings for items that have multiple versions
# Used to ensure consistency between Ruby data generation and TypeScript variant resolution

# Items with color-based variants (flowers)
FLOWER_VARIANTS = {
  "Blue Jazz" => ["Blue Jazz (Blue)", "Blue Jazz (Pink)", "Blue Jazz (White)"],
  "Tulip" => ["Tulip (Red)", "Tulip (Pink)", "Tulip (White)"],
  "Summer Spangle" => ["Summer Spangle (Magenta)", "Summer Spangle (Pink)", "Summer Spangle (White)"],
  "Fairy Rose" => ["Fairy Rose (Pink)", "Fairy Rose (Red)", "Fairy Rose (White)"],
  "Poppy" => ["Poppy (Red)", "Poppy (Orange)", "Poppy (White)"],
  "Sunflower" => ["Sunflower (Yellow)", "Sunflower (Orange)", "Sunflower (White)"]
}

# Items with ID-based variants
ID_VARIANTS = {
  "Strange Doll" => {
    "126" => "Strange Doll (Green)",
    "127" => "Strange Doll (Yellow)"
  }
}

# Name aliases for consistency
NAME_ALIASES = {
  "Wild Seeds (Sp)" => "Spring Seeds",
  "Wild Seeds (Su)" => "Summer Seeds",
  "Wild Seeds (Fa)" => "Fall Seeds",
  "Wild Seeds (Wi)" => "Winter Seeds"
}

# Get all variant display names for a base item
def get_variants(base_name)
  FLOWER_VARIANTS[base_name] || [base_name]
end

# Apply name alias if it exists
def apply_alias(name)
  NAME_ALIASES[name] || name
end

# Check if an item has variants
def has_variants?(name)
  FLOWER_VARIANTS.key?(name) || ID_VARIANTS.key?(name)
end
