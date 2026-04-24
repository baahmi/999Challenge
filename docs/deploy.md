# Deploy `999challenge` to GitHub Pages at `999.isallineed.com`

## Summary

Create a new GitHub repository with a clean initial history, publish the app as a static GitHub Pages site from the built `dist/` output using GitHub Actions, and attach the custom domain `999.isallineed.com` directly to GitHub Pages via DNS.

This fits the current app shape: the repo already builds to a static browser bundle (`bun run build` -> `dist/`) and does not need a backend.

## Implementation Changes

### 1. Create the clean GitHub source tree

- Create a new GitHub repo for the public/clean source of the app.
- Import the current working tree as a single initial commit instead of carrying over the old commit history.
- Before import, decide what should be excluded from the clean repo:
  - keep source, docs you still want, build script, package files
  - exclude `dist/`, local environment junk, editor files, and any generated or copied files you do not want to maintain there
- After the cutover, continue development in the new repo only.

### 2. Make the repo GitHub Pages friendly

- Add a proper `.gitignore` if it is missing or incomplete, at minimum excluding:
  - `dist/`
  - `node_modules/`
  - local IDE/system files
- Keep the existing Bun-based build as the deploy build:
  - install dependencies
  - run `bun run build`
  - publish `dist/`
- Ensure the built app uses relative asset paths or a Pages-safe public path so the custom-domain root works cleanly.
- Add a `CNAME` file to the published site content containing:
  - `999.isallineed.com`
- The easiest implementation is to have the workflow write `dist/CNAME` before deploy, or commit a source `CNAME` template and copy it during build.

### 3. Add GitHub Actions deployment

- Add one deployment workflow that runs on pushes to the default branch.
- Workflow behavior:
  - checkout repo
  - install Bun
  - run `bun install`
  - run `bun run build`
  - add `CNAME` to `dist/`
  - deploy `dist/` to GitHub Pages using the official Pages actions
- Configure repository settings:
  - Pages source = GitHub Actions
  - default branch = whichever branch you will continue from in the new repo
- Prefer Actions over pushing built files to a special branch; it keeps the source repo clean.

### 4. Point the custom domain to Pages

- In GitHub Pages settings, set the custom domain to:
  - `999.isallineed.com`
- In your DNS provider, create the subdomain record for `999` pointing to GitHub Pages.
- If your DNS provider supports it, enable HTTPS once GitHub has validated the domain.
- If `isallineed.com` has restrictive DNS or proxy settings today, remove any conflicting record for `999` before attaching it to Pages.

### 5. Cutover and validation

- First validate on the default GitHub Pages URL.
- Then attach `999.isallineed.com`.
- Confirm:
  - app loads at the custom domain
  - refresh works on the root page
  - uploaded save workflow still works in the browser
  - no asset 404s
  - no mixed-content or CSP issues
- Once validated, treat the new GitHub repo as the authoritative source tree.

## Public Interfaces / Repo Additions

- New GitHub repository with clean history
- New `.github/workflows/...` Pages deployment workflow
- New or updated `.gitignore`
- Pages custom-domain configuration via `CNAME`
- No backend/API changes

## Test Plan

- Local:
  - `bun install`
  - `bun run build`
  - verify `dist/index.html` and bundled assets are produced
- GitHub:
  - push to default branch
  - verify Actions build and deploy succeed
  - verify GitHub Pages serves the site
- Domain:
  - verify `999.isallineed.com` resolves correctly
  - verify GitHub Pages HTTPS is active
  - verify the app loads and works after hard refresh
- Functional smoke test:
  - open Overview
  - open category tabs
  - use `/` search
  - open Help dialog
  - upload a save file and confirm UI updates

## Assumptions

- Use a new repo rather than an orphan branch in the existing repo.
- Serve `999.isallineed.com` directly from GitHub Pages.
- Keep deployment source as the existing Bun static build; no hosting rewrite is needed.
- The app remains frontend-only and browser-executed; no server-side processing is planned.
- Domain DNS is under your control and can be updated for the `999` subdomain.

## Notes

- GitHub Pages/custom-domain behavior should follow GitHub's current Pages docs:
  - https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages

- When you are ready to implement, the safest execution order is:
  1. prepare clean repo locally
  2. add workflow
  3. verify Pages URL
  4. switch DNS
  5. continue work from the new GitHub repo
