# Quick Guide: Adding New Item Variants

## For Color-Based Variants (like flowers)

### Step 1: Find the color values
Look in your save file for the item:
```xml
<Item>
  <name>NewFlower</name>
  <color>
    <R>255</R>
    <G>100</G>
    <B>50</B>
    <A>255</A>
  </color>
</Item>
```

### Step 2: Add to `itemVariants.json`
```json
{
  "variantDefinitions": {
    "NewFlower": {
      "baseItemId": "999",
      "variantType": "color",
      "variants": [
        {
          "displayName": "NewFlower (Red)",
          "colorRGBA": {"R": 255, "G": 0, "B": 0, "A": 255},
          "distinguisher": "red"
        },
        {
          "displayName": "NewFlower (Blue)",
          "colorRGBA": {"R": 0, "G": 0, "B": 255, "A": 255},
          "distinguisher": "blue"
        }
      ]
    }
  }
}
```

### Step 3: Add to `variant_mappings.rb`
```ruby
FLOWER_VARIANTS = {
  # ... existing entries ...
  "NewFlower" => ["NewFlower (Red)", "NewFlower (Blue)"]
}
```

### Step 4: Update `items.json`
Find the flower entry and expand it:
```json
["Flowers", "NewFlower", "NewFlower (Red)"],
["Flowers", "NewFlower", "NewFlower (Blue)"]
```

### Step 5: Test
1. Upload a save with the item
2. Verify it shows with correct color variant name
3. Check that different colors are tracked separately

## For ID-Based Variants (like Strange Doll)

### Step 1: Identify the item IDs
Check the game data or save file for different IDs with same name.

### Step 2: Add to `itemVariants.json`
```json
{
  "variantDefinitions": {
    "NewItem": {
      "baseItemId": "100",
      "variantType": "itemId",
      "variants": [
        {
          "itemId": "100",
          "displayName": "NewItem (Variant A)",
          "distinguisher": "variant_a"
        },
        {
          "itemId": "101",
          "displayName": "NewItem (Variant B)",
          "distinguisher": "variant_b"
        }
      ]
    }
  }
}
```

### Step 3: Add to `variant_mappings.rb`
```ruby
ID_VARIANTS = {
  # ... existing entries ...
  "NewItem" => {
    "100" => "NewItem (Variant A)",
    "101" => "NewItem (Variant B)"
  }
}
```

### Step 4: Update `items.json`
```json
["Category", "NewItem", "NewItem (Variant A)"],
["Category", "NewItem", "NewItem (Variant B)"]
```

## For Name Aliases (like Wild Seeds)

### Step 1: Identify the mismatch
- Recipe uses: "Wild Seeds (Sp)"
- Items.json has: "Spring Seeds"

### Step 2: Add to `itemVariants.json`
```json
{
  "nameAliases": {
    "Wild Seeds (Sp)": "Spring Seeds"
  }
}
```

### Step 3: Add to `variant_mappings.rb`
```ruby
NAME_ALIASES = {
  # ... existing entries ...
  "Wild Seeds (Sp)" => "Spring Seeds"
}
```

### Step 4: Update `parts.json`
Use the canonical name (after alias):
```json
["Spring Seeds", {
  "16": ["Wild Horseradish", 1]
}, 10]
```

## Common Pitfalls

❌ **Don't** use different names in items.json and parts.json
✅ **Do** use the displayName (third field) in items.json

❌ **Don't** forget to update both TypeScript and Ruby files
✅ **Do** keep itemVariants.json and variant_mappings.rb in sync

❌ **Don't** use approximate color values
✅ **Do** extract exact RGBA from save files

❌ **Don't** forget the distinguisher field
✅ **Do** use short, unique identifiers (red, blue, green, etc.)

## Checklist

- [ ] Added to `itemVariants.json`
- [ ] Added to `variant_mappings.rb`
- [ ] Updated `items.json` with all variants
- [ ] Updated `parts.json` if needed (recipes)
- [ ] Tested with real save file
- [ ] Verified no console errors
- [ ] Checked that variants track separately

## Need Help?

1. Check existing variants in `itemVariants.json` for examples
2. Read `VARIANTS.md` for detailed documentation
3. Look at the Strange Doll or Blue Jazz implementations
4. Test with a save file that has the item
