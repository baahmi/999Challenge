# Changelog

### Notes
- I have only tested with the "Highest Quality" settings, so not sure the other settings functions.
- I cannot guarantee that uploads are "stable", so dependning on changes . My goal is to make soure eg conversion is happning.
- I have not tested storage limits. We use localstorage, which has a limited size.
- The metadata is probably not full correct yet.
- I will try to move my code that generates the metadata at some point. 
- Have plan to add images
- You can use / to search for items and jump to the tab where it is.

## [Unreleased]

### Added
- Overview category columns for `Gold spend` and `Qi spend`.

### Changed
- Overview gold and Qi coverage now use owned stacks for spend/remaining math, even when the current quality target is still incomplete.

### Fixed
- Price metadata corrections in `prices.json`, which also removed several downstream overview and tooltip pricing mistakes.
- `Statue Of Endless Fortune` now contributes its 1,000,000g value in overview totals through a local price override until the generated price data is corrected.
- Shop tooltips now show `Casino` prices as `Qi coins` instead of gold when the generated entry has no explicit currency.
