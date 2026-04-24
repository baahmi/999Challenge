# Changelog

All notable changes to this project should be recorded in this file.

The format is intentionally simple:

- Keep a top-level `## [Unreleased]` section for ongoing work.
- When cutting a release, move unreleased items into a versioned section like `## [0.1.0] - 2026-04-23`.
- Group entries under `Added`, `Changed`, `Fixed`, and `Removed` where useful.

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

- Build-time app version and build date metadata, now shown in the GUI footer.
- Help dialog available from the header icon bar.
- Keyboard search overlay opened with `/` to jump to tabs and item categories.
- Initial deployment notes in `docs/deploy.md`.

### Changed

- Help is now presented as a popup dialog instead of a tab so the tab bar stays data-focused.

### Fixed

- Required-count propagation issues for recipe chains and wildcard ingredients.
- Total overcounting from crafted-item surplus.
- Local bundled item metadata now wins over stale localStorage display-name state.
- Quality handling for cooking, flowers, wine, smoked fish, animal products, shellfish, and wildcard extra rows.
- Overview rows can jump directly to their matching category tab.
