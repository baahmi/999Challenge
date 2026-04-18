# Item Variants System

## Overview

Stardew Valley has items that appear identical in the game data but are actually distinct items that players need to collect separately. This system handles those variants.

## Types of Variants

### 1. Color-Based Variants (Flowers)

Flowers in Stardew Valley can have different colors based on the `<color>` element in the save file. Each color is tracked separately for the 999 challenge.

**Affected Items:**
- Blue Jazz: Blue, Pink, White
- Tulip: Red, Pink, White
- Summer Spangle: Magenta, Pink, White
- Fairy Rose: Pink, Red, White
- Poppy: Red, Orange, White
- Sunflower: Yellow, Orange, White

**Save File Format:**
```xml
<Item>
  <name>Blue Jazz</name>
  <color>
    <R>35</R>
    <G>127</G>
    <B>255</B>
    <A>255</A>
    <PackedValue>4294934307</PackedValue>
  </color>
</Item>
```

### 2. ID-Based Variants (Strange Doll)

Some items have the same name but different item IDs.

**Affected Items:**
- Strange Doll (Green) - ID 126
- Strange Doll (Yellow) - ID 127

### 3. Name Aliases

Some items have different names in recipes vs. the game data.

**Aliases:**
- `Wild Seeds (Sp)` → `Spring Seeds`
- `Wild Seeds (Su)` → `Summer Seeds`
- `Wild Seeds (Fa)` → `Fall Seeds`
- `Wild Seeds (Wi)` → `Winter Seeds`

## File Structure

### `itemVariants.json`
Defines all known variants and their properties:
```json
{
  "variantDefinitions": {
    "Blue Jazz": {
      "baseItemId": "597",
      "variantType": "color",
      "variants": [...]
    }
  },
  "nameAliases": {
    "Wild Seeds (Sp)": "Spring Seeds"
  }
}
```

### `VariantResolver.ts`
TypeScript class that:
- Resolves item names from save data
- Matches colors to variants
- Applies name aliases
- Generates unique keys for tracking

### `variant_mappings.rb`
Ruby constants used by data generation scripts to ensure consistency.

## Usage

### In TypeScript

```typescript
import { VariantResolver } from './data/CustomDataStore';

// Resolve a flower variant from save data
const displayName = VariantResolver.resolveDisplayName(
  "Blue Jazz",
  undefined,
  { R: 35, G: 127, B: 255, A: 255 }
);
// Returns: "Blue Jazz (Blue)"

// Resolve Strange Doll variant
const dollName = VariantResolver.resolveDisplayName(
  "Strange Doll",
  "126"
);
// Returns: "Strange Doll (Green)"

// Apply name alias
const seedName = VariantResolver.applyAlias("Wild Seeds (Sp)");
// Returns: "Spring Seeds"

// Get all variants for an item
const variants = VariantResolver.getVariants("Tulip");
// Returns: ["Tulip (Red)", "Tulip (Pink)", "Tulip (White)"]
```

### In Ruby Scripts

```ruby
require_relative 'variant_mappings'

# Get variants for flowers
get_variants("Blue Jazz")
# Returns: ["Blue Jazz (Blue)", "Blue Jazz (Pink)", "Blue Jazz (White)"]

# Apply alias
apply_alias("Wild Seeds (Sp)")
# Returns: "Spring Seeds"

# Check if item has variants
has_variants?("Tulip")
# Returns: true
```

## Data Files

### `items.json`
Contains separate entries for each variant:
```json
["Flowers", "Blue Jazz", "Blue Jazz (Blue)"],
["Flowers", "Blue Jazz", "Blue Jazz (Pink)"],
["Flowers", "Blue Jazz", "Blue Jazz (White)"]
```

The third element is the `displayName` that will be shown in the UI.

### `parts.json`
Uses the canonical names (after alias resolution):
```json
["Spring Seeds", {
  "16": ["Wild Horseradish", 1],
  ...
}, 10]
```

## Adding New Variants

1. **Add to `itemVariants.json`:**
   ```json
   "NewFlower": {
     "baseItemId": "999",
     "variantType": "color",
     "variants": [
       {
         "displayName": "NewFlower (Red)",
         "colorRGBA": {"R": 255, "G": 0, "B": 0, "A": 255},
         "distinguisher": "red"
       }
     ]
   }
   ```

2. **Add to `variant_mappings.rb`:**
   ```ruby
   FLOWER_VARIANTS = {
     # ...
     "NewFlower" => ["NewFlower (Red)", "NewFlower (Blue)"]
   }
   ```

3. **Update `items.json`:**
   ```json
   ["Flowers", "NewFlower", "NewFlower (Red)"],
   ["Flowers", "NewFlower", "NewFlower (Blue)"]
   ```

4. **Regenerate data** by running the Ruby scripts.

## Color Matching

The `VariantResolver` uses:
1. **Exact match** first (all RGBA values match exactly)
2. **Fuzzy match** with tolerance of ±10 for slight variations
3. Returns `null` if no match found (item will use base name)

## Future Enhancements

- **Mod support**: Allow mods to register custom variants
- **Dynamic color detection**: Auto-detect new color variants from save files
- **Variant completion tracking**: Show progress for each variant separately
- **1.7 compatibility**: Update for new items in Stardew Valley 1.7
