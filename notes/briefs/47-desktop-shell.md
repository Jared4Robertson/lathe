# Brief: Lathe as a desktop app (an Electron shell)

Read [00-common-rules.md](00-common-rules.md) first. Base branch: `main`. Work in your own worktree, and finish with your branch ready to merge.

## Goal
Jared wants Lathe as a desktop app: its own window and dock icon, opening a product's folder. He wants to keep hot reload while iterating.

This brief is step 2 of three. Step 1 would have been an installable web app. Step 3, a signed, downloadable build with auto-update, comes later and needs Jared's approval to publish. Here, build the Electron shell for daily use, plus an unsigned local build he can run.

## What exists
- `lathe serve` (`lathe/src/server/serve.ts`, `serve({ root, port, host, appDir })`) serves the built app (`lathe/dist/app` or similar), the `/api/*` routes (`lathe/src/server/api.ts`) and the live-reload events. It watches the product's `specs/` and `model/` and pushes `spec:changed` and `model:changed`.
- In development, Vite serves the app with hot reload. Jared's own dev server is on **port 5199**. `app/server/lathe.ts` (the `latheApi(root)` Vite plugin) gives it the same API and events, for the repo root.
- The engine uses DuckDB through `@duckdb/node-api`, a Node-API module, so it should load in Electron without a rebuild. Confirm that.

## Decisions already made (Jared, and the coordinator's recommendations)
1. **A new `desktop/` package** in the repo: Electron, TypeScript, and electron-builder for packing.
   - The main process starts Lathe's server in-process with `serve()`, on a free local port (never 5199), for the chosen product folder. The window loads it.
   - Security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a tiny preload that exposes only what's below on `window.latheDesktop`.
   - Links leaving the app open in the system browser.
2. **Opening a product.** "Open product folder…" (Cmd+O) picks a folder that holds a `lathe.config.json`, or else a `specs/` folder; otherwise it says what's missing. The shell remembers recent folders (File › Open Recent, last 10) in the user data folder, and the last folder reopens on launch. Each folder opens in its own window. The window title is the product's name and the folder.
3. **Hot reload while iterating** (`npm --prefix desktop run dev`):
   - If Jared's dev server answers on `http://localhost:5199`, the window loads it, so app changes hot-reload exactly as in the browser and his server is shared.
   - Otherwise the shell starts its own Vite dev server for `app/` on a free port with `latheApi(root)` for the opened folder, and loads that.
   - Changes to the main process or preload restart Electron automatically, through electron-vite or a small watcher.
   - Spec changes live-reload in every mode, as they do now.
   - The dev server's product root must follow the opened folder. Make `latheApi` and `vite.config.ts` read it from an environment variable such as `LATHE_ROOT`, defaulting to this repo. Keep that change small, and make sure it changes nothing for Jared's 5199 server.
4. **Menus:**
   - Native menus: File (Open, Open Recent, Close Window), Edit, View (Reload, Toggle Developer Tools, zoom, Toggle Full Screen) and Window, plus Help (Record format, Keyboard shortcuts).
   - App commands go through the existing command system. The preload forwards a menu choice as a command ID (`viewWiki`, `toggleNav` and so on), and the app's `CommandsProvider` runs it.
   - Expose `window.latheDesktop.isDesktop`, so the keymap can show desktop-only bindings later. Don't change bindings in this brief.
5. **Window state:** each window's size and position are remembered. The app opens with the shell background, so there's no white flash.
6. **Local build:** `npm --prefix desktop run pack` builds an **unsigned** macOS app for the current architecture (`--dir`, or a local .dmg) into `desktop/release/`, which is ignored by git. It builds the app first (`npm --prefix lathe run build`). No signing, no notarizing, no publishing, and no auto-update yet; that is step 3.
7. **Icon:** use the chuck logo from `brand/`, rendered to the sizes electron-builder needs.

## Lathe's own spec
- **A new domain** `LA-DSK` "Desktop" under `LA`:
  - folder `specs/lathe/desktop/` with `domain.md`;
  - a capability `LA-DSK-CAP01` "The desktop app" holding the use cases:
    - "Open a product in a window";
    - "Iterate on Lathe with hot reload in the desktop app";
    - "Use Lathe from the native menus";
  - each use case with requirements, domain rules, components in layers, and tests.
- **Product description:** update the delivery paragraph in `specs/lathe/product.md` to say Lathe also runs as a desktop app (Electron), with signed builds and auto-update still to come.
- Follow the App code pattern wherever it applies, and the structure-size limits.

## Tests
- Unit tests (vitest in `desktop/`) for:
  - folder validation;
  - the recent folders list (order, dedupe, limit);
  - window-state saving;
  - choosing the dev URL (5199 when it answers, else its own server).
- A smoke test that runs Electron headless or hidden, waits for the window, and checks through the Chrome DevTools Protocol, or `webContents.executeJavaScript`, that the app shows the opened product's name and that `/api/spec` answered.
  - Run it locally. If it can't run in CI without a display, mark it to run only on macOS, and say so.
  - Wire `desktop`'s tests into the full checks in 00-common-rules: add `npm --prefix desktop test` there.

## Scope
- **You own:** `desktop/**`, the small `LATHE_ROOT` change in `app/server/lathe.ts` and `app/vite.config.ts`, the root `.gitignore` entries, the `notes/briefs/00-common-rules.md` checks line, and the LA-DSK records and the product paragraph.
- **Working at the same time:** brief 45 (the Model view and panes) is in `app/src/**`. Stay out of it.
- Never use port 5199 for anything you start; only connect to it when it answers. Stop everything you start.

## Report
Use the format in 00-common-rules, with your branch and its last commit. Also give the commands Jared runs (dev, start, pack), what you saw when you launched it, and what step 3 (signing, notarizing, auto-update, Windows and Linux builds) needs from him.
