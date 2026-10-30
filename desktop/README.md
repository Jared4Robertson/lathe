# Lathe desktop

Lathe as a desktop app: an Electron shell around the Lathe web app and server. Each window shows one product folder (a folder with `lathe.config.json` or a `data/` folder of the product's data files), with every other product its `lathe.config.json` lists under `products`, served by Lathe's own `serve()` on a free local port, from the product's own installed Lathe (`node_modules/@jaredrob/lathe`, built) when it has one and the app's bundled copy otherwise, so a product is read by the Lathe its data was written for (About names which, as "Opened with"): the same server, reading and writing the data through the store, as `lathe serve` and the app's dev server. Its specification is part of the Platform domain (`LA-PLT`) in Lathe's own data.

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
- **A chat with Claude.** Ctrl+Cmd+I (or the title bar's chat button, or View › Show or Hide Chat) opens a panel at the right that runs your own Claude Code in the window's folder: the `claude` CLI, headless, with your login, settings, skills, plugins, MCP servers and `CLAUDE.md` (`chat.ts`, `chatSession.ts`). It lists the folder's saved sessions to resume or fork, warns when one may be open in another Claude client, shows Claude's answers with record links, tool calls, permission prompts (Allow once or Deny) and the records each turn changed, and stops a turn on Escape. Lathe's MCP server gets two more tools there, `app_focus` and `app_open`, which reach the window through a local bridge (`bridge.ts`). Lathe finds `claude` on the PATH or where its installers put it; set `claudePath` in `settings.json` otherwise.
- **Lathe's tools in every chat.** Each session loads the Lathe plugin of the Lathe the window runs (`--plugin-dir`: the product's own Lathe's `dist/plugin`, else the app's), and its MCP server runs that same Lathe (`LATHE_CLI`), so the tools are there whether or not the plugin is installed; a session plugin takes the place of an installed one of the same name, so the tools are never listed twice (`chatLathe.ts`). The head shows how many tools the session has and from which Lathe; the empty chat says when `claude` is missing or not signed in (`claude auth status`), with the fix.
- **Permission modes.** One control under the chat's head: Ask (every tool asks, reads too: ask rules through `--settings`), Accept reads (the default: `--allowedTools Read,Grep,Glob` and Lathe's check, `app_focus` and `app_open`, and the panel allows Lathe's other read tools, marked `readOnlyHint`), Auto (`--permission-mode auto`), Bypass (`--permission-mode bypassPermissions`, after a warning, with a badge while on) and View only (Lathe's server lists only its reads, Claude Code's tools that write or run code are `--disallowedTools`, and the panel refuses any other prompt for a tool that may change things, saying why). Changing the mode starts the CLI again on the same session; each folder keeps its last mode (`chat-modes.json`). A prompt's **Allow always in this chat** lets that tool run for the rest of the chat.
- **Where you are.** Each message goes with what you are looking at (product, page, stage, focused record, selection), shown as a removable chip above the message box and sent as a `<lathe-focus>` block before the message; Claude is told to start from it and to use `app_focus` and `app_open`, never the code, for anything about the window.

What the app keeps (recent folders, window states, chrome colors, settings) is in small JSON files in Electron's user data folder.

## Tests and type checks

```sh
npm --prefix desktop run typecheck   # tsc --noEmit
npm --prefix desktop test            # vitest, at most 2 workers
```

The unit tests cover the modules `main.ts` uses that need no Electron (folders, menus, the Dock, editors, record actions, the launch pages and more). `test/smoke.test.ts` runs the real shell, hidden, on a small product folder and checks what it shows; it runs on macOS only, and builds the Lathe package first if it is not built.
