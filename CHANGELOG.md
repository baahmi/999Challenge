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
#### 0.1.3
- now also imports of past save files show the right statistics. So if you import day 1000 and import day 500 after that, it shows the progress instead of showing 0 for the imported day 500. Importing in order would not give this problem.
- Add optione to show item ids as in the game (mainly used for making debugging easier)
- Fix needed count in total row.
- Removed Incubator (the fixed egg incubator in coops) and Feed Hopper (the fixed hay feeder in deluxe coops and barns)
- Filter out furniture items called "House Plant"

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
