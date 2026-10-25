# Lathe

A lathe is a tool that makes tools, including better lathes. Lathe organizes a product's lifecycle (domain model, use cases, interaction design, technical specification, test plan) as records: one Markdown file per record, kept in the product's own repo. A database loads them, checks them against a meta-model, traces each obligation to the code that builds it and the tests that prove it, and a web app lets you read and navigate the result.

Lathe describes itself in its own format: its specification is under [specs/lathe/](specs/lathe/), and `lathe check` runs on it as on any product. Most records are written by agents; the [Claude Code plugin](plugin/) teaches them the format and checks their edits as they go. Specs name roles (Owner, Reader, Agent), never people.

## What's here

| Folder | What it is |
| --- | --- |
| [lathe/](lathe/) | The tool: the engine, the `lathe` command, the server and the record format. Packaged as `@jaredrob/lathe`; see its [README](lathe/README.md). |
| [app/](app/) | The web app's source. Built into the package for `lathe serve`. |
| [desktop/](desktop/) | Lathe as a desktop app: an Electron shell around the web app and server. See its [README](desktop/README.md). |
| [plugin/](plugin/) | The Claude Code plugin: skills for writing records, and a hook that checks every spec edit. |
| [specs/lathe/](specs/lathe/) | Lathe's own specification (product `LA`). |
| [specs/tool-library/](specs/tool-library/) | The example product's specification (product `TL`). |
| [examples/tool-library/](examples/tool-library/) | The example product's code, whose tests carry their spec IDs. |
| [lathe-checks/](lathe-checks/) | This repo's own checks, run after Lathe's. |
| [model/](model/) | CSV diagrams (People and tools, SDLC Brainstorm), shown in the app's Diagrams. |
| [NOTES.md](NOTES.md) | The thinking and decisions so far. |
| [notes/briefs/](notes/briefs/) | Reusable briefs for agents working on Lathe. |

## Run it

Install each package you need (Node 26):

```sh
npm --prefix lathe install && npm --prefix app install && npm --prefix desktop install
```

| What | Command |
| --- | --- |
| The web app, for working on Lathe | `npm --prefix app run dev` serves this repo at http://localhost:5199 and reloads as specs, checks or app code change. `LATHE_ROOT=/path/to/product` points it at another product repo; `-- --port <n>` picks another port. |
| Check the specs | `npm --prefix lathe run check` prints errors, warnings and coverage, and exits 1 on any error. |
| The record format | `npm --prefix lathe run lathe -- format --root ..` prints the concepts, then every kind, relation, folder and check of this repo. |
| Serve a built app | `npm --prefix lathe run build`, then `npm --prefix lathe run lathe -- serve --root ..` serves the built app at http://127.0.0.1:5330. |
| The desktop app | `npm --prefix desktop run dev` (hot-reloading), `npm --prefix desktop run start` (from the built package) or `npm --prefix desktop run pack` (a `Lathe.app` in `desktop/release/`). |

The npm scripts run in `lathe/`, so `--root ..` names this repo. In a product repo, the same commands are `npx lathe check`, `npx lathe format` and `npx lathe serve`; the [package README](lathe/README.md) has every option.

## A tour of the app

- **Spaces.** Each product is a space. The rail at the far left of the nav has one icon per product; Alt+1 to Alt+9 switch between them. The nav, quick find and Checks follow the current space.
- **The nav's folders.** Under each domain, the nav follows the stages and folders of the meta-model: Define (Domain model, Capabilities) and Design (Interaction design, Technical specification, Test plan), with the product's Shared folder (patterns) above the domains. Components sit in their layers and tests in groups by what they prove.
- **Views.** A record, group, domain or product page opens in one or more views side by side: **Wiki** (the record as a page: its body, fields, children, links in and out, and problems; a domain page adds its stages, coverage and open questions), **Graph** (the records around it as boxes and arrows, by level), and **Model** (the ERD of a domain's aggregates or an aggregate's entities). Toggle them from the page bar or with Ctrl+W, Ctrl+G and Ctrl+M (Alt off a Mac); Ctrl+3 makes the focused view full screen. The address names the open views (`?view=wiki,graph`), so a link opens as it was seen.
- **Tabs.** Each space keeps its own tabs, as VS Code's editors: a new page opens in the preview tab (italic) until you keep it (double-click, or Ctrl+K Enter). Ctrl+Tab cycles; Alt+Shift+W closes.
- **The side bar.** The inspector, on the right, shows the focused record's kind, fields, parent, children, links both ways, problems and coverage gaps, and what the graph connects to it. Mod+Alt+B shows or hides it, and its edge drags to resize.
- **Quick find and the palette.** Mod+P (or Mod+K) jumps to any record, domain, product or diagram by ID or title, the current space first. Mod+Shift+P opens the command palette, which runs any command by name.
- **Shortcuts.** Press `?` for the shortcuts sheet. Others: Mod+B hides the nav, `g c` opens Checks, `g f` the record format, `g d` Diagrams, `g h` home, F8 the next problem on the page, F12 the focused link's record. Mod is Cmd on a Mac and Ctrl elsewhere.
- **Themes.** Five built-in themes (Lathe, Graphite, Midnight, Workshop, High contrast), each light, dark or following the system, and themes of your own, made and edited in Settings › Appearance (`g t` picks one).
- **Checks and the format.** Checks lists every problem, filtered by space. The record format pages (`g f`) show the concepts and a page per kind and per check, generated from the meta-model.
- **Mobile.** Below 900 px wide the app shows one view at a time, with a compact top bar, the nav as a drawer and the inspector as a bottom sheet. On a touch screen, targets are at least 44 px and a tap on a graph box selects it before a second tap opens it.

## The format

Records live in the specs folder `lathe.config.json` names (here [specs/](specs/)). [lathe/FORMAT.md](lathe/FORMAT.md) gives the concepts, and [lathe/REFERENCE.md](lathe/REFERENCE.md), generated by `lathe format`, lists every kind, relation, folder and check.
