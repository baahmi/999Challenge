# Changelog

### Notes
- I have only tested with the "Highest Quality" settings, so not sure the other settings functions.
- I cannot guarantee that uploads are "stable", so dependning on changes . My goal is to make soure eg conversion is happning.
- I have not tested storage limits. We use localstorage, which has a limited size.
- The metadata is probably not full correct yet.
- I will try to move my code that generates the metadata at some point. 
- Have plan to add images
- You can use / to search for items and jump to the tab where it is.

### Changes
#### 0.1.5
- The Total column no longer clamps at the Required value once a row is complete: completed rows show real holdings (raw plus actual crafting consumption, uncapped) so the surplus is visible. Percentages and Needed are unchanged.

#### 0.1.4
- Lucky shorts now in overview. Forgot the "Lucky" part
- Cranberries images shows now 
- Flower color variants now show their sprite with the correct petal color, and smoked fish get their smoked (dark) look
- Smoked fish whose name ends in "s" (Octopus, Blue Discus, Largemouth Bass, ...) now show their image too
- Items whose name is ambiguous (Chicken Statue, Bait) now use the save file's item id for their image, and the Egg/Milk/Fish Extra rows show a representative image. Every row has an image now.
- Repaired "Manage categories & items": the header button works again. Add/rename/delete categories, assign items to categories (including the unassigned "asdf" ones), search and filter items. Changes apply to the tables immediately and persist as deltas (item ids only, never names), so app data updates don't fight stale stored copies.
- Header shows the exact in-game date (season, day, year — a year is 112 days), centered on the bar
- Overview gets a "What can I finish?" section: unfinished craftables you can complete right now from surplus ingredients. It keeps a full stack of every ingredient reserved, only counts target-quality surplus for smoked fish, never feeds iridium fish into cooked dishes, credits wine/cheese that only needs aging, and counts the Qi Seasoning surplus for cooked dishes. Click an item to jump to its row.
- The ⚠ in recipe tooltips now only appears when an ingredient is actually short of what is needed to finish the item. Before it marked the ingredient limiting further crafting, even on completed items (e.g. Gold Ore on a finished Bomb: Mega).
- Recipe tooltips now show how many ingredients you still need: each ingredient line gets "have X / need Y" where Y covers the crafts remaining to finish the item (yield-aware, e.g. fish for bait), and the recipe header shows how many of the item are still needed
- Searching with "/" now scrolls to the item's row and highlights it briefly, instead of just switching tabs
- Header now shows Pocket money and Total earned (before the Qi Gems). Total earned is stored 32-bit in the save and overflows past ~2.1 billion; a new setting "Money limit reached" says how often you passed the limit so the corrected total can be shown. A negative save value is auto-corrected as passed-once.
- Add config items to have things on normal quality (eg fish, food, wine)
- Added function "I am a loser". Some people forget where they have put their weapon or 100.000 of something. I lost something yesterday and that triggered me to add this (next to a request from the public)

#### 0.1.3
- now also imports of past save files show the right statistics. So if you import day 1000 and import day 500 after that, it shows the progress instead of showing 0 for the imported day 500. Importing in order would not give this problem.
- Add optione to show item ids as in the game (mainly used for making debugging easier)
- Fix needed count in total row.
- Removed Incubator (the fixed egg incubator in coops) and Feed Hopper (the fixed hay feeder in deluxe coops and barns)
- Filter out furniture items that have known name like "House Plant"
- Egg extra's now correctly shows the egg count that is in surplus

#### 0.1.2
- Added Apache-2.0 license for source and documented the permission to use Stardew images.
- Cheese Cauliflower, Vegetable Medley, Cookie, Eggplan Permasan, Cranberry Sauace and Dish o' the sea are now correctly processed and shows ingredients now on tooltip after a name correction
- Now shows (Trimmed) Purple Shorts and adds the fact it needs a Golda Bar to creat a trimeed one.
- Squid Ink and Sea Urchin cannot be smoked or made into bait.
- Now storing items based on id, instead of name, since they are clashing. Side effect is that it now shows eg Stone Owl and Stone Owl (Spawned) and the eggs correctly (all normal chicken eggs have the name "Egg", just another Id for color and size)
- Since uploaded metadata is not compatible anymore, you need to reupload the data. You can select multiple files. The test with 125 save files takes time, but with progress it at least shows what it is doing
#### 0.1.1
- Deploy commits now bump the app version, so the footer version is tied to what is actually running in production.
- Overview category columns for `Gold spend` and `Qi spend`.
- Overview gold and Qi coverage now use owned stacks for spend/remaining math, even when the current quality target is still incomplete.
- Footer build info now includes the full build timestamp and git commit short SHA so each production deploy is identifiable.
- Price metadata corrections in `prices.json`, which also removed several downstream overview and tooltip pricing mistakes.
- Metadata fixes for `Hops`, and removal of invalid generated entries like `Daffodil Juice` and `Pickles` where they are not real item targets.
- `Statue Of Endless Fortune` now contributes its 1,000,000g value in overview totals through a local price override until the generated price data is corrected.
- Shop tooltips now show `Casino` prices as `Qi coins` instead of gold when the generated entry has no explicit currency.
- Highest-quality ingredient accounting now treats ageable artisan goods correctly, so fruits like `Cherry` and `Pineapple` can be complete while their normal-quality wines still show as aging-needed blue rows.
