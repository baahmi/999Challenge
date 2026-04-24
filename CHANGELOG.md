# Changelog

All notable changes to this project should be recorded in this file.

The format is intentionally simple:

- Keep a top-level `## [Unreleased]` section for ongoing work.
- When cutting a release, move unreleased items into a versioned section like `## [0.1.0] - 2026-04-23`.
- Group entries under `Added`, `Changed`, `Fixed`, and `Removed` where useful.

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
