# Lathe desktop

Lathe as a desktop app: an Electron shell around the Lathe web app and server. Each window shows one product folder (a folder with `lathe.config.json` or a `data/` folder of the product's data files), served by Lathe's own `serve()` on a free local port, from the product's own installed Lathe (`node_modules/@jaredrob/lathe`, built) when it has one and the app's bundled copy otherwise, so a product is read by the Lathe its data was written for (About names which, as "Opened with"): the same server, reading and writing the data through the store, as `lathe serve` and the app's dev server. Its specification is part of the Platform domain (`LA-PLT`) in Lathe's own data.

## Run it

From the Lathe repo, after `npm --prefix lathe install`, `npm --prefix app install` and `npm --prefix desktop install`:

| Command | What it does |
| --- | --- |
| `npm --prefix desktop run dev` | Builds the shell and starts Electron in development mode: windows load the app from a Vite dev server, so app changes hot-reload, and the shell rebuilds and restarts when `src/` changes. It uses the owner's dev server on port 5199 when that one serves the same folder, and otherwise starts its own on a free port. |
| `npm --prefix desktop run start` | Builds the Lathe package and the shell, then runs Electron on the built package, as the packed app does. |
| `npm --prefix desktop run pack` | Builds everything and packs an unsigned `Lathe.app` into `desktop/release/mac-<arch>/`. `pack:dmg` makes a disk image instead. |
| `npm --prefix desktop run icon` | Renders the app icons in `build/` from `build/icon.svg` (needs `rsvg-convert` and ImageMagick). The icons are committed, so packing does not need this. |

Add a folder to open it: `npm --prefix desktop run dev -- ~/path/to/product`. With none, the app opens the most recent folder that still opens, then (unpacked) this repo, and otherwise asks for one.

If Electron fails to start or pack because `node_modules/electron/dist` is missing, its download did not run during install: run `node desktop/node_modules/electron/install.js`.

## What it adds to the web app

- **Folders and windows.** File › Open and Open Recent, one window per folder (opening a folder again focuses its window), folders opened from Finder or dropped on the Dock icon, and one running instance. Window sizes and places are remembered.
- **Its own title bar.** The app draws the title bar, with back and forward and the window's controls over it, in the theme's colors.
- **Record actions.** Reveal a record's data file (`data/<kind>.jsonl`) in Finder, open it in an editor, or copy its ID. File › Open Records In chooses the editor: VS Code (the default), Cursor, Zed, the system's default app for the file, or a command of your own (`editorCommand` in `settings.json`).
- **The Dock.** Its badge counts the check errors in the focused window's product; its menu has New Window.
- **Launch and error pages.** A launch view covers the window until the specs load, and an error page says why a folder could not be opened.
- **Menus.** The app's commands are in the native menus, without taking any key from the app's own keymap. Settings (Cmd+,) opens Appearance.

What the app keeps (recent folders, window states, chrome colors, settings) is in small JSON files in Electron's user data folder.

## Tests and type checks

```sh
npm --prefix desktop run typecheck   # tsc --noEmit
npm --prefix desktop test            # vitest, at most 2 workers
```

The unit tests cover the modules `main.ts` uses that need no Electron (folders, menus, the Dock, editors, record actions, the launch pages and more). `test/smoke.test.ts` runs the real shell, hidden, on a small product folder and checks what it shows; it runs on macOS only, and builds the Lathe package first if it is not built.
