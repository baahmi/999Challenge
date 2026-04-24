# Generator Refactor Access Plan

When it is time to refactor the Ruby data generator and this frontend toward one source of truth, the cleanest setup is to give Codex access to both projects in the same workspace.

## Preferred Setup

Put both projects under one parent folder and start Codex from that parent.

Example:

```text
/Users/mvdb/projects/gaming/stardew/
  999challenge/
  generator-project/
```

Then start Codex from:

```bash
cd /Users/mvdb/projects/gaming/stardew
codex
```

This lets Codex inspect both repos, compare generated JSON to the Ruby source, run the generator if needed, and make coordinated changes without copying files back and forth.

## Acceptable Alternatives

1. Add the Ruby project as another writable workspace root for the session.
2. Move or symlink the Ruby project under this repo temporarily, for example `999challenge/generator`.
3. Copy snapshots of the Ruby files and generated JSON into this repo for read-only analysis.
4. Paste individual files into chat for narrow questions.

The first two options are best for real refactoring. The last two are only useful for analysis or small fixes.

## Files Codex Should See

For the actual refactor, Codex should have access to:

- Ruby generator source
- original game input files or representative fixtures
- generated `items.json`, `parts.json`, `prices.json`, and `trove.json`
- scripts or commands used to regenerate the JSON
- frontend code that consumes those generated files

## Refactor Goal

The generator should become the single source of truth where possible, using original game files to reduce manual work when Stardew Valley releases new versions. The frontend should consume richer generated static data so calculation code can be simpler, less special-cased, and easier to verify.
