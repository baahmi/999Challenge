
## App: Stardew Valley 999 Challenge Tracker

Goal: track progress toward collecting 999 of every item in Stardew Valley. The player loads their XML save file; the app shows per-category tables with required/total/raw counts and crafting dependency tooltips.

### Tech Stack
- **Runtime/bundler**: Bun (see rules below)
- **UI**: React 18, TypeScript, TSX
- **Component library**: MUI (Material-UI) — tabs, icons, dialogs, theme
- **Styling**: plain CSS modules per component + `styles/globals.css` + `src/index.css`
- **Entry**: `src/index.html` → `src/frontend.tsx` → `<App />`
- **Dev server**: `bun run dev` (uses `build.ts`)

### Data Files (`src/data/`)

| File | Structure | Purpose |
|---|---|---|
| `items.json` | `[categoryName, itemName][]` | Master list of all items per category. Some have placeholder category `"asdf"` — needs fixing. |
| `parts.json` | `[craftedItemName, {ingredientId: [ingredientName\|null, qty]}][]` | Crafting recipes. Ingredient keys are numeric item IDs (negative = wildcard category, skip) or string names. `null` ingredient name = wildcard (skip). Some name mismatches vs items.json (e.g. `"Cookies"` vs `"Cookie"`, `"Cheese Cauli."` vs `"Cheese Cauliflower"`). |
| `categories.json` | `{ names: string[], ignored: number[], ids: Record<string,string> }` | Valid category names (used as tab labels), ignored category IDs, and numeric category ID → name mapping. |
| `notes.json` | `Record<string, string>` | Item name → freetext note. Currently empty `{}` — populate as needed. |

### Key Source Files

**`src/app/AppData.ts`** — singleton, event emitter
- `loadXmlFile(file)` — parses the Stardew Valley XML save, extracts all inventory items
- `compactItems()` — deduplicates by name, sums stacks across quality levels
- `state.compacted` — **typed** as `Record<string, extractedItem>` but **stored at runtime as an array** `Array<{name, itemId, category, stack, quality: number[]}>`. Always cast: `state.compacted as unknown as Array<{name: string; stack: number}>`
- `AppData.subscribe(fn)` — returns unsubscribe fn; called on every data change
- Static helpers: `AppData.getQiGems()`, `AppData.getDaysPlayed()`

**`src/data/itemCalculations.ts`** — core computation, no React
- Pre-builds two static maps at module load from `parts.json`:
  - `recipeMap`: `craftedName → Map<ingredientName, qty>`
  - `reverseMap`: `ingredientName → craftedName[]`
- `computeCategoryItems(categoryName, compacted)` → `ItemRow[]`
  - `required` = 999 + Σ(qty × 999) for every recipe that uses this item as ingredient
  - `total` = Σ(qty × inventory[craftedItem]) — how many used in crafting so far
  - `raw` = current inventory count from compacted
  - `tooltip` = full `ItemTooltipData` (recipe details + usedBy with sub-ingredients)
  - Pass `'All'` for categoryName to get all items
- `logDataIssues(compacted)` — logs mismatches to console (call once after XML load):
  - items.json entries with category `"asdf"`
  - parts.json crafted/ingredient names not found in items.json
  - inventory items not in items.json

**`src/types/Item.ts`** — interfaces
- `Item`: `{name, required, total, raw}`
- `ItemWithCalculations`: `Item & {percentage}`
- `percentage` = `(raw + total) / required × 100`
- `enrichItemsWithCalculations(items, _categoryTotal)` — adds `percentage` to each item; generic so extra fields (like `tooltip`) are preserved via spread

**`src/config/Config.ts`** — singleton, localStorage-backed
- `Config.getCategoryNames()` — returns tab names from `categories.json`
- `Config.getSelectedTab()` / `Config.setSelectedTab()`
- `Config.getTabsPosition()` — `'top'` | `'bottom'`
- `Config.getTheme()` — `'light'` | `'dark'`
- `Config.getInstance().subscribe(fn)` — returns unsubscribe fn

**`src/components/main/Main.tsx`** — root content component
- Subscribes to both `AppData` and `Config`
- Pre-renders **all categories at once** (`allCategoryData` map via `useMemo`)
- Switches tabs by toggling `display: none` — no re-computation on tab switch
- Calls `logDataIssues` after each XML load

**`src/components/tabs/Tabs.tsx`** — tab bar (MUI TabContext/TabList)
- `tabs-top`: `flex-direction: column` (tabs above content)
- `tabs-bottom`: `flex-direction: column-reverse` (tabs directly below content — "connected to table")
- Children rendered in `.tab-content`; Main.tsx controls visibility via `display:none`

**`src/components/table/ItemTable.tsx`** — item table with tooltip
- Props: `items: ItemRow[]`
- Totals row at top and bottom (bold, grey background)
- Name cell: **green + bold** when `percentage >= 100%`
- Hover tooltip (`position: fixed`, `pointer-events: none`): shows recipe with ingredient inventory counts and all "used in" entries with their sub-ingredients. Green = sufficient, red = insufficient.
- Tooltip position flips left/up near viewport edges

**`src/components/header/Header.tsx`** — sticky header
- File upload button → `AppData.loadXmlFile()`
- Shows Qi Gems + Days Played from AppData
- Toggle tabs top/bottom button
- Settings dialog

### Layout Architecture

Page scrolls naturally (no `overflow: hidden` on root). Header is sticky.

```
html/body/#root   — no height/overflow constraints
  .app            — min-height: 100svh, CSS grid (min-content / 1fr / min-content)
    <Header>      — position: sticky; top: 0; z-index: 100
    <Main>        — flex column, fills 1fr grid row
      .container  — flex column, grows with content
        .tabs-container.tabs-bottom  — flex column-reverse
          .tab-content  — all ItemTables (inactive: display:none)
          .tabs-wrapper — tab bar, appears directly below table content
    <Footer>
```

### Column Semantics

| Column | Meaning |
|---|---|
| **%** | `(raw + total) / required × 100` |
| **Required** | 999 base + 999×qty for each recipe that uses this item |
| **Total** | Items already consumed in crafting (qty × crafted-count per recipe) |
| **Raw** | Current inventory from save file |

### Known Data Quality Issues
- Many items in `items.json` have category `"asdf"` (placeholder — needs correct category assigned)
- Name mismatches between `parts.json` and `items.json` mean those recipes don't contribute to required/total calculations for the mismatched names. Check browser console `[parts.json]` warnings after loading a save.
- `parts.json` ingredient IDs: negative numbers (e.g. `-4`, `-5`, `-6`) are category wildcards (any fish, any egg, any milk) — these are skipped.

---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
